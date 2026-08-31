/**
 * MATCH LOBBY — where the match is configured, and the one screen that says what a
 * seat actually is.
 *
 * ── The ask, verbatim (`DECISIONS §74`, Uri, 2026-08-12) ────────────────────
 * > *"We need the lobby where the gameplay is set, to be able to choose how many players,
 * > and assign bots to the one who plays locally. Also wire it up to multiplayer — real
 * > users can join the game as well (from UI perspective); the actual connection to
 * > multiplayer will be done later."*
 *
 * That withdraws the standing default in `brawl.ts` — *"stays behind `?fighters=` and no
 * player can reach it"* — and it is four things, of which the fourth is the dangerous one.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 1. 🚨 THE TRAP: A JOIN BUTTON THAT DOES NOTHING IS THE DEFECT THIS PROJECT
 *    HAS PAID FOR FOUR TIMES
 * ═══════════════════════════════════════════════════════════════════════════
 * `src/net/` is built, tested and **inert**: a wire codec, 7.1× delta compression, a
 * loopback host/client stack proved bit-identical at every snapshot. And there is no
 * server and no session — `transport.ts` contains `LoopbackHub` and nothing else, no
 * `WebSocket`, no `RTCPeerConnection`, no `fetch`, and **zero files under `src/` import
 * it**. Nobody can join anything today, and no code path could.
 *
 * So a seat that looks joinable and is not would be the UI-asserts-what-the-model-does-not-do
 * class, and the record on it is: `DECISIONS §13` (*"the stat card is fiction"*, with the
 * rarity ramp running backwards); the shop promising *"Epic or better"* two hours after
 * rarity stopped granting power; three *"shows a number the model does not compute"*
 * defects in the menus; and 20 of 34 weapon descriptions, which Uri found himself.
 * ⚠️ **"It is obviously a placeholder" is not a defence** — every one of those looked
 * obvious to whoever wrote it.
 *
 * ── The answer: THERE IS NO "OPEN" SEAT STATE ───────────────────────────────
 * The trap only exists if a fourth seat state called *open* is invented. There are three
 * states here and only two are seats:
 *
 *   `YOU`   slot 0, always — your equipped fighter and its level.
 *   `BOT`   every other seated slot — the character `brawlRoster` will actually seat, and
 *           the level `enemyLevelFor` will actually give it.
 *   —       slots at or above the count: not rendered. Not in the match.
 *
 * **Today every seat but yours is a bot, so every seat but yours says `Bot`, which is
 * true.** The multiplayer affordance ships as a `disabled` control ON the bot seat,
 * labelled with what it will DO rather than with whether it is available — which is
 * `shop.ts`'s own precedent, and its wording is the rule:
 *
 * > *"Every unavailable control carries the DOM `disabled` attribute, so it cannot be
 * > tapped, cannot be focused, and is excluded from the control census **by construction
 * > rather than by a check someone can forget**."*
 * > *"An unexplained disabled button is the same defect."*
 *
 * So `OPEN_SEAT_LABEL` is *"Open to a player"* — true on ship day, and still true and
 * still correct on transport day, because it never described availability. The `disabled`
 * attribute did, and the reason is on the control (`title` + `aria-label`) as well as in
 * one sentence at the top of the screen.
 *
 * ⚠️ **Why not an actually-open seat that blocks Start?** Because a human can never
 * arrive, so it would be a state the match can never start from — a lobby the player can
 * put into a dead end. Strictly worse than the four defects above.
 *
 * ── ...and the availability is DERIVED, never a boolean somebody has to flip ──
 * `openSeat` is `null` when no transport can reach another device. The banner, the
 * `disabled` attribute and the control's reason all read that one expression, so the day
 * `net/host.ts` gains a session factory the whole screen comes alive with no edit here.
 * Same shape as `shop.ts:sellable()`, and for the same reason: a `const ONLINE = false`
 * is a second place the truth lives.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 2. WHERE IT SITS, AND WHY IT IS NOT ON THE `Start Game` BUTTON
 * ═══════════════════════════════════════════════════════════════════════════
 * The obvious wiring is `home.ts`'s primary CTA, and a peer's design spec proposed the
 * near-equivalent (replace character select's FIGHT destination). Both were **refused by
 * a measurement, not by taste**:
 *
 *   * `tools/tmp/journey.mjs` — *the only end-to-end gate in this project* — and
 *     `tools/match-play.mjs` both drive `click [data-el="start"]` →
 *     `waitForFunction('window.__screen === "characters"')` → `click [data-el="fight"]`.
 *     Re-pointing home's CTA breaks both, at a 120 s timeout each, and neither file is in
 *     this pass's owned set. **HEAD was unbootable for 24 commits with every unit gate
 *     green**; shipping a red end-to-end gate to save one tap is not a trade.
 *   * `characterSelect.ts` is not in the owned set either, so its FIGHT could not be
 *     re-pointed even if that were the better product answer (it probably is — see the
 *     handover note at the bottom).
 *
 * So the lobby is reached from **the mode block in home's footer**, which is where the
 * reference plates put mode configuration (a wide tappable band immediately left of the
 * primary CTA) and where ours already sat as a dead `<div>`. `Start Game` still goes to
 * character select, and character select's FIGHT still starts the duel it always started
 * — which is also what keeps `2f907a7`'s four-arm `np_identity` bit-identity intact **by
 * construction rather than by re-measurement**: that path has not been touched at all.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 3. WHAT THIS SCREEN MUST NOT DO
 * ═══════════════════════════════════════════════════════════════════════════
 *   1. **Never set a level.** `enemyLevelFor(playerLevel)` is *"the single place Uri's
 *      answer lives"* (`match.ts`). This screen may only DISPLAY a bot level by calling
 *      it — echoing the player's own level would be a copy that goes stale the day
 *      `ENEMY_LEVEL_MODE` stops being `'mirror'`. It also never constructs a
 *      `net/lobby.ts:LobbySeat`, whose `level` field is exactly the second setter.
 *   2. **Never choose a spawn, and never reorder the roster.** `sim.ts:defaultSpawn`
 *      resolves slot *i* to `arena.spawns[i]` and `kitchen.ts` interleaves that array so
 *      N=2/4/6 are complete sets of mirrored pairs. Slot order IS placement; reordering
 *      can silently revert the 2.680 → 0.342 places `kx_seatfair` bought.
 *   3. **Never pass a roster.** `types.ts` refuses it by design — the route carries a
 *      COUNT — so the "which five characters" policy stays in one file Uri can overrule.
 *      This screen may *render* `brawlRoster(...)`; it navigates with `seats`.
 *   4. **Never retype the seat range.** `SEAT_CHOICES` and `seatCountFor` come from
 *      `brawl.ts`, which imports `MIN_FIGHTERS`/`MAX_FIGHTERS` from `state.ts`.
 *   5. **`2` maps to `seats: undefined`, not to `seats: 2`.** The duel has one path
 *      (`brawl.ts` states why), and that is what preserves bit-identity. `seatCountFor`
 *      is that mapping and this file does not second-guess it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 4. WHAT IT COSTS, MEASURED ELSEWHERE, AND SAID OUT LOUD
 * ═══════════════════════════════════════════════════════════════════════════
 * `net/lobby.ts:fillWithBots` carries the number: a six-human tick is **2.66 µs**, six
 * bots is **399.50 µs** — **150×**, 99.2% of it `stepAI`'s BFS flow field (`NETCODE.md`
 * §5). A 6-seat local match is **5 bots on the phone Uri plays on, and nobody has
 * measured a 6-fighter match on a phone** — `DECISIONS §74`'s device capture is a
 * two-fighter one, and its own instrument *"can prove jank; it cannot prove smoothness."*
 * That is why the default seat count is `MIN_FIGHTERS` and not the maximum: the lobby
 * makes the unmeasured arm REACHABLE, deliberately, but it does not make it the default
 * every player lands in.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 5. THE LOADOUT — Uri, 2026-08-31: *"up to 2 items per player, he sets it up
 *    on the loby, which ones he wants to use out of what he has"*
 * ═══════════════════════════════════════════════════════════════════════════
 * `rules.ts:ITEMS` is the registry, `ITEM_SLOTS` is the two, and this screen is the
 * "sets it up on the lobby" half. Four things about it are decisions rather than code.
 *
 * ── 5a. 🚨 THE EQUIPPED SET LIVES IN ITS OWN `localStorage` KEY, AND THAT IS A
 *        CONSEQUENCE OF FILE OWNERSHIP, NOT A DESIGN PREFERENCE ──────────────
 * The right home for "what I take into a match" is `EconomyState`, beside `unlocked` and
 * `levels`, reached through `PlayerProfile`. **Neither file is in this pass's owned set**
 * and both have live editors right now, so this pass cannot put it there.
 *
 * ⚠️ And *"just add a key to the profile blob"* is not available either — it is a
 * measurable trap, not a taste call. `profile.ts:PlayerProfile.commit()` serialises a
 * FIXED SIX-FIELD OBJECT built from its own `data` (`name`, `wins`, `losses`, `xp`,
 * `selected`, `economy`) and writes it over `food-arena.profile.v1`. Any seventh key
 * written into that blob from outside is **destroyed by the next profile write**, which
 * is every rename, every match result and every level purchase. A loadout stored there
 * would survive exactly until the player did anything.
 *
 * So: `LOADOUT_KEY` below, read and written only here, with `loadEquipped`/`saveEquipped`
 * exported so the match side has one function to call rather than a storage format to
 * copy. **This is a LODGER and the eviction plan is written down**: the day one owner
 * holds `economy/state.ts` + `profile.ts`, the array moves onto `EconomyState`,
 * `deserialize` adopts this key once, and the two functions below become three-line
 * delegations exactly like `characterLevel`. Recorded in the handover so it is a
 * scheduled move rather than a second source of truth nobody remembers.
 *
 * ── 5b. WHAT YOU OWN IS READ FROM THE ECONOMY, NEVER INVENTED HERE ─────────
 * `ownedItemIds()` is a SEAM against a model that is being written in parallel
 * (`economy/tuning.ts` already carries the box drop rows). It reads the field off
 * `EconomyState` if it is there and returns `[]` if it is not, and `[]` is the correct
 * answer today rather than a fallback: **nothing in the shipped tree grants an item, so
 * every player owns none**, which is also the state every new player is in forever after
 * the faucet lands. `tools/tmp/il_seam.mjs` parses `EconomyState` and fails if the
 * ownership field appears under a name this file does not read — so the day the
 * acquisition track lands, a red row names the exact line to change instead of a lobby
 * that quietly shows nothing.
 *
 * ── 5c. THE HONESTY LINE, AND WHY THE SLOTS ARE *NOT* `disabled` ───────────
 * §1 above disables the multiplayer control because **pressing it could do nothing** —
 * there is no transport to call. Equipping is not that: the press does the whole of what
 * it claims, the choice is stored, and it survives a reload. What is NOT yet true is that
 * a match reads it, so that sentence is on the screen (`MATCH_READS_LOADOUT`), derived
 * from the tree by `il_seam.mjs` rather than remembered. Disabling the slots instead
 * would make the feature unreachable in order to describe it, which is strictly worse
 * than describing it accurately.
 *
 * ── 5d. THE PICKER LISTS ALL TEN, INCLUDING THE ONES YOU DO NOT OWN ────────
 * ⚠️ Deliberate, and adjacent to a defect class this file's §1 spends fifty lines on, so
 * it is argued rather than assumed. The shop's *"Epic or better"* was a promise about a
 * BENEFIT that did not exist. A row reading **"Not owned yet"** claims only that the item
 * exists in the game, which `rules.ts:ITEMS` makes true, and it carries `disabled` plus
 * the reason on both `title` and `aria-label` — `shop.ts`'s own precedent. The
 * alternative, a picker that renders nothing at all for the ~100% of players who own
 * nothing, is a control that does nothing, which is the defect §1 actually names.
 */

import {
  CHARACTER_IDS, CHARACTERS, ITEMS, ITEM_SLOTS, RARITY_COLORS, RARITY_ORDER,
  type CharacterId, type ItemDef, type ItemId,
} from '../../game/rules';
import { enemyLevelFor } from '../../game/economy';
import { MIN_FIGHTERS } from '../../game/state';
import { SEAT_CHOICES, brawlRoster, seatCountFor } from './brawl';
import type { Route, Screen, ScreenContext } from './types';
import { injectStyles } from './theme';
import { el } from './fx';
import { ensureIconStyles, hydratePortraits, icon, portraitMarkup } from '../icons';

declare global {
  interface Window {
    /**
     * QA-only transport injection, same spirit as `shell.ts`'s `__shellFault` and
     * `match.ts`'s `?simSpeed=`.
     *
     * It exists because *"the banner appears when there is no transport"* asserted in one
     * direction is a constant with a tick next to it, not a measurement — `CLAUDE.md` rule
     * 6's vacuity class. `tools/tmp/lb_accept.mjs` sets this to a function and requires
     * every join control to come ALIVE and the banner to disappear, then clears it and
     * requires the opposite. Costs one property read per mount.
     */
    __faOpenSeat?: ((slot: number) => void) | null;
    /**
     * QA-only ownership injection, the same argument `__faOpenSeat` makes one line above.
     *
     * `ownedItemIds()` returns `[]` on the shipped tree because nothing grants an item
     * yet, so every row about owned items would be asserted over an EMPTY SET and pass
     * vacuously — `[].every()` is `true`, which is the failure mode `CLAUDE.md` rule 6
     * records firing three times in three files in one session. `tools/tmp/il_accept.mjs`
     * sets this, requires the picker and the slots to come alive, then clears it and
     * requires the empty state back. Costs one property read per render.
     *
     * ⚠️ It injects what you OWN, never what is equipped: equipping still goes through
     * the same handler a finger does, so the persistence rows measure the real path.
     */
    __faOwnedItems?: readonly string[] | null;
  }
}

/**
 * THE ONE EXPRESSION THAT KNOWS WHETHER ONLINE PLAY EXISTS.
 *
 * `null` — nothing in `src/` imports `src/net/`, `transport.ts` has no socket of any kind,
 * and there is no server. The day `net/host.ts` gains a session factory, this becomes that
 * factory and every control below enables itself. **Do not replace this with a boolean**:
 * a `const ONLINE = false` is a second place the answer lives, and the answer is "is there
 * something to call", which a function type states and a boolean only describes.
 */
const ONLINE_SEAT_OPENER: null | ((slot: number) => void) = null;

/**
 * The label on the multiplayer control. **It names what the control DOES.**
 *
 * Not *"Waiting for player…"* (a claim about a state nothing is in), not *"Coming soon"*
 * (`home.ts`'s standing rule: there is no "soon" anywhere in this product), not
 * *"Join"* — you are not joining, you are opening your seat to someone else. On transport
 * day the `disabled` attribute comes off and this string is unchanged and still correct.
 */
const OPEN_SEAT_LABEL = 'Open to a player';

/** Why the control above is off. Names the state, never the calendar. */
const OFFLINE_REASON =
  'Online play is not connected yet. This seat is played by a bot.';

/**
 * The whole state of the screen, in one sentence, at the top.
 *
 * Composed from the model rather than typed: the count of bot seats is `n - 1`, and the
 * sentence is only rendered while `openSeat === null`. A player should not have to infer
 * "these buttons are grey" from a colour.
 */
function offlineBanner(botSeats: number): string {
  return `Online play is not connected yet, so ${botSeats === 1 ? 'the other seat is' : `all ${botSeats} other seats are`} `
    + 'played by a bot. Opening a seat to another player is switched off rather than '
    + 'offered as a button that does nothing.';
}

export function createLobbyScreen(ctx: ScreenContext): Screen {
  injectStyles('fa-lobby-styles', CSS);
  ensureIconStyles();

  /**
   * The transport, or the absence of one. Read ONCE per mount so every control on the
   * screen agrees with the banner — a per-control read could disagree with itself if the
   * capability changed between two renders.
   */
  const openSeat: null | ((slot: number) => void) =
    window.__faOpenSeat !== undefined ? window.__faOpenSeat : ONLINE_SEAT_OPENER;
  const joinable = openSeat !== null;

  const player: CharacterId = ctx.profile.selected;

  /**
   * SEAT 1, rolled ONCE per mount.
   *
   * ⚠️ **Once, and that is the honesty requirement, not a performance one.** The seat list
   * below is `brawlRoster(player, enemy, n)` — the real function `matchScreen.ts` will call
   * — so if `enemy` were re-rolled on each render the list would show a field the Start
   * button then does not seat, which is the decorative-list defect `lb_accept.mjs`'s H5 row
   * exists to catch.
   *
   * This is the same rule `characterSelect.ts:pickOpponent` implements for the duel path,
   * and it is the ONLY randomness anywhere near a seat: `brawlRoster` fills slots 2+ in
   * declaration order and the sim contains none at all, which is what underwrites 110
   * matchups, the pacing ladder and `kx_seatfair`'s 600-match seat spread.
   *
   * ⚠️ It is deliberately NOT on the route (`types.ts` says why): a rolled value in the URL
   * is a Back button that re-enters with an opponent chosen for a different visit.
   */
  const enemy: CharacterId = pickOpponent(player);

  /** The chosen count. `MIN_FIGHTERS` — see the header §4: the default is the measured arm. */
  let seats: number = SEAT_CHOICES[0];

  const root = el('div', 'fa-screen fa-lobby');
  root.innerHTML = `
    <header class="fa-topbar">
      <button class="fa-iconbtn" type="button" data-el="back" aria-label="Back to home">${icon('back')} Back</button>
      <h1 class="fa-title lobby-heading">Match Lobby</h1>
      <div class="fa-topbar-spacer"></div>
      <div class="fa-chip ds-chip"><span class="fa-chip-em">${icon('party')}</span>Players <span class="fa-chip-val ds-chip-val ds-num" data-el="count">2</span></div>
    </header>

    <div class="lobby-body">
      <p class="lobby-note" data-el="note"></p>
      <div class="fa-panel fa-panel--flush lobby-seatswrap">
        <div class="fa-scroll lobby-seats" data-el="seats"></div>
      </div>
    </div>

    <footer class="lobby-bottom">
      <div class="lobby-count">
        <span class="fa-panel-title lobby-count-title" id="lobby-count-label">Players in this match</span>
        <div class="lobby-count-opts" role="group" aria-labelledby="lobby-count-label" data-el="opts"></div>
      </div>
      <button class="fa-btn ds-btn ds-btn--primary lobby-start" type="button" data-el="start">${icon('play')} Start</button>
    </footer>
  `;

  const q = <T extends HTMLElement>(sel: string): T => {
    const node = root.querySelector<T>(`[data-el="${sel}"]`);
    if (!node) throw new Error(`lobby: missing element "${sel}"`);
    return node;
  };

  const seatsEl = q<HTMLDivElement>('seats');
  const optsEl = q<HTMLDivElement>('opts');
  const noteEl = q<HTMLParagraphElement>('note');

  // ── The seat-count control ─────────────────────────────────────────────────
  //
  // A segmented row of `MIN_FIGHTERS..MAX_FIGHTERS`, not a `<select>` and not a ± pair.
  // One tap reaches any count (± needs up to four), it reads as STATE rather than as a
  // machine you operate, and it is the only form that fits: five 44 px targets plus gaps
  // is ~250 px inside 360 px minus safe areas, where a two-column seat grid is not.
  //
  // ⚠️ Sized to 44 px from CSS and never from its label. Text-driven box widths drift
  // ~±2 CSS px between snapshot runs on the same tree (measured on `.home-mode`,
  // 268 → 266 at 1600×900), and `menu_accept_portrait`'s `MIN_TAP - 0.5` slack is INSIDE
  // that drift — so a tap target whose size comes from its text is a coin flip.
  for (const n of SEAT_CHOICES) {
    const b = el('button', 'ds-btn lobby-opt');
    b.type = 'button';
    b.dataset.seats = String(n);
    b.textContent = String(n);
    // The count is the label, so the label alone would read as "2" to a screen reader with
    // no idea what of. Stated per option rather than relying on the group name.
    b.setAttribute('aria-label', `${n} players`);
    optsEl.appendChild(b);
  }

  function renderCount(): void {
    q('count').textContent = String(seats);
    for (const b of optsEl.querySelectorAll<HTMLButtonElement>('.lobby-opt')) {
      const on = Number(b.dataset.seats) === seats;
      b.classList.toggle('is-on', on);
      // `aria-pressed`, not `disabled`: the current option must stay tappable and
      // focusable. A control that disables itself when selected is a control the player
      // cannot get back to, and it would also drop out of the accessibility tree at the
      // exact moment it carries the answer.
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  // ── The seat list ──────────────────────────────────────────────────────────

  /**
   * One row per seat, and every row says what that seat IS.
   *
   * The list is `brawlRoster(player, enemy, seats)` — the same pure function
   * `matchScreen.ts` calls with the same three arguments — so this is not a decoration of
   * the match, it is the match. `lb_accept.mjs` recomputes it in Node and compares
   * element-wise, having first asserted the list is non-empty, because every honesty row
   * in that file passes vacuously over a screen that renders no seats.
   */
  function renderSeats(): void {
    const roster = brawlRoster(player, enemy, seats);
    const yourLevel = ctx.profile.characterLevel(player);
    // 🚨 CALLED, never echoed. `enemyLevelFor` is the single place Uri's "AI players are
    // adjusted to the player's level" answer is expressed; a `yourLevel` printed on a bot
    // row would be a copy that agrees today only because `ENEMY_LEVEL_MODE` is 'mirror'.
    const botLevel = enemyLevelFor(yourLevel);

    seatsEl.innerHTML = roster.map((id, slot) => {
      const you = slot === 0;
      const name = CHARACTERS[id].name;
      const level = you ? yourLevel : botLevel;
      const tag = you ? 'You' : 'Bot';
      const action = you
        ? `<button class="ds-btn ds-btn--icon lobby-seat-act" type="button" data-el="swap"
             title="Change your fighter" aria-label="Change your fighter">${icon('swap')}</button>`
        // 🚨 THE MULTIPLAYER CONTROL. `disabled` is written from `joinable`, which is
        // `openSeat !== null` — never from a literal — so the day a transport exists this
        // markup enables itself. The reason is on BOTH `title` (pointer) and `aria-label`
        // (touch/AT), because a phone has no hover and a tooltip nobody can reach is not a
        // reason. The label names what the control does; the attribute names whether it
        // can be used, and those are different sentences on purpose.
        : `<button class="ds-btn ds-btn--icon lobby-seat-act lobby-seat-open" type="button"
             data-el="open" data-slot="${slot}"${joinable ? '' : ' disabled'}
             title="${OPEN_SEAT_LABEL}. ${OFFLINE_REASON}"
             aria-label="${OPEN_SEAT_LABEL} — seat ${slot + 1}. ${joinable ? '' : OFFLINE_REASON}">${icon('avatar')}</button>`;
      return `
        <div class="lobby-seat${you ? ' is-you' : ''}" data-seat="${slot}" data-char="${id}">
          <span class="lobby-seat-pic">${portraitMarkup(id, { crop: 'head' })}</span>
          <span class="lobby-seat-body">
            <span class="lobby-seat-name" data-el="seat-name">${name}</span>
            <span class="lobby-seat-tag"><b>${tag}</b> · Lv ${level}</span>
          </span>
          ${action}
        </div>`;
    }).join('');
    // Same call home and character select make. The renders land progressively off an idle
    // callback into the session cache; a cold cache shows the neutral fighter mark on the
    // character's own rarity colour, which reads as "a fighter" and never as a wrong one.
    hydratePortraits(seatsEl);
  }

  function renderNote(): void {
    // Present iff there is no transport — the same expression the `disabled` attribute
    // reads. Asserted in BOTH directions by `lb_accept.mjs` via `window.__faOpenSeat`.
    noteEl.textContent = joinable ? '' : offlineBanner(seats - 1);
    noteEl.hidden = joinable;
  }

  function render(): void {
    renderCount();
    renderSeats();
    renderNote();
  }

  // ── Wiring ─────────────────────────────────────────────────────────────────
  // One delegated listener, so a control added later cannot be silently unwired — the
  // same shape `home.ts` and `shop.ts` use.
  const onClick = (ev: MouseEvent): void => {
    const node = ev.target as HTMLElement | null;
    const opt = node?.closest<HTMLElement>('.lobby-opt');
    if (opt) {
      const n = Number(opt.dataset.seats);
      if (Number.isInteger(n) && n !== seats) { seats = n; render(); }
      return;
    }
    const open = node?.closest<HTMLElement>('[data-el="open"]');
    if (open) {
      // Unreachable while `openSeat` is null — a `<button disabled>` emits no `click` at
      // all — and written from the capability anyway so the day it flips there is nothing
      // to remember. `?? ` rather than `!`: this must not be able to throw on a screen.
      openSeat?.(Number(open.dataset.slot));
      return;
    }
    if (node?.closest('[data-el="swap"]')) { ctx.navigate({ name: 'characters' }); return; }
    if (node?.closest('[data-el="back"]')) ctx.navigate({ name: 'home' });
  };
  root.addEventListener('click', onClick);

  q<HTMLButtonElement>('start').addEventListener('click', () => {
    // 🚨 `seatCountFor`, NOT `seats`. At `MIN_FIGHTERS` it returns `undefined`, which is
    // what every shipped navigation has always carried and what makes `matchScreen.ts`
    // take the two-seat path with not one branch changed. Mapping the lobby's own `2` to
    // `seats: 2` instead would route the duel down the fighter-LIST form — "almost
    // certainly identical", which is the exact phrase the identity battery exists so that
    // nobody has to say. The policy lives in `brawl.ts`; this line does not restate it.
    const route: Route = { name: 'match', player, enemy, seats: seatCountFor(seats) };
    ctx.navigate(route);
  });

  render();

  return {
    root,
    dispose() {
      root.removeEventListener('click', onClick);
      root.remove();
    },
  };
}

/**
 * Seat 1, at random from everyone who is not you.
 *
 * ⚠️ **A DELIBERATE SECOND COPY OF `characterSelect.ts:pickOpponent`, DECLARED HERE
 * RATHER THAN HIDDEN.** That file is not in this pass's owned set, so the two cannot be
 * merged today. They are the same three lines and the same rule, and the moment somebody
 * owns character select the right move is to delete both and take one from here — at
 * which point character select's FIGHT can navigate to `{ name: 'lobby' }` and the whole
 * duplicate disappears with it. Recorded in the handover so it is a scheduled removal
 * rather than a drift waiting to happen.
 */
function pickOpponent(player: CharacterId): CharacterId {
  const pool = CHARACTER_IDS.filter((id) => id !== player);
  return pool[Math.floor(Math.random() * pool.length)];
}

const CSS = `
/* The heading SHRINKS and the controls beside it do not. 'flex: 0 0 auto' here squeezed
   the Back pill's own padding at 360px — the row was over budget and the only item that
   could give was the one that should never give. */
.fa-lobby .lobby-heading {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fa-lobby .fa-topbar > .fa-iconbtn,
.fa-lobby .fa-topbar > .fa-chip { flex: 0 0 auto; }

/* ── THE PANEL HUGS ITS CONTENT, AND THAT IS A MEASUREMENT ──────────────────────
   First draft was 'flex: 1 1 auto' on the panel — i.e. fill the row — and the 1600x900
   capture was a 1500x670 cream rectangle with four 64px rows at the top of it and
   OVER HALF THE FRAME EMPTY. That is this project's oldest named defect, recorded in
   'home.ts''s header as "more than half the frame was empty cyan", and it arrived here
   the same way: a container told to fill a row that is much bigger than its contents.

   'flex: 0 1 auto' lets the panel be as tall as its seats and no taller, capped by the
   row so it still scrolls when six seats do not fit. The leftover is the warm backdrop,
   which is a field, not a void. The width cap is the same idea on the other axis: a seat
   row 1500px wide puts the name and its control at opposite ends of the screen with a
   metre of nothing between them. */
.fa-lobby .lobby-body {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  /* Centred in the band, because a hugging panel pinned to the TOP of a 900px row leaves
     550px of backdrop under it and reads as a screen that failed to finish loading. On a
     phone the content fills the band and this is a no-op. */
  justify-content: center;
  gap: var(--gap);
  min-height: 0;
}
.fa-lobby .lobby-note,
.fa-lobby .lobby-seatswrap {
  width: min(100%, 880px);
  margin-inline: auto;
}

/* The state of the screen, in words, above the thing it describes. Cream on the warm
   backdrop rather than inside a panel: it is a caption on the whole list, and a panel
   would make it read as one more piece of data to compare. */
.fa-lobby .lobby-note {
  /* 'margin-block', NOT 'margin' — a blanket 'margin: 0' here overrode the shared
     'margin-inline: auto' above (it is declared later and wins), and the banner rendered
     hard against the left edge while the panel it describes sat centred 340px away.
     Caught by reading the 1600x900 PNG, not by any assertion in 'lb_accept'. */
  margin-block: 0;
  flex: 0 0 auto;
  font-family: 'Heebo', sans-serif;
  font-size: clamp(0.78rem, 1.9vh, 0.95rem);
  line-height: 1.35;
  color: var(--cream);
  text-shadow: 0 2px 0 rgba(26,18,36,0.55);
}
.fa-lobby .lobby-note[hidden] { display: none; }

.fa-lobby .lobby-seatswrap { flex: 0 1 auto; min-height: 0; }
/* A GRID, so the column count is one declaration. One column is the portrait answer and
   it is measured: 360px minus safe areas cannot hold two portraits, two names and two
   44px controls in a row. */
.fa-lobby .lobby-seats {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  gap: 8px;
  padding: 10px;
}

/* ONE COLUMN, at every width, and that is a measurement rather than a preference:
   360 px minus safe areas cannot hold two portraits, two names and two 44 px controls in
   a row. Six rows at ~64 px fit the 547 px free band a 360x800 phone leaves under the
   header and above the footer; '.fa-scroll' takes the overflow on the tall-content case
   so the page itself never scrolls. */
.fa-lobby .lobby-seat {
  display: flex;
  align-items: center;
  gap: 10px;
  /* Floor 64, and it grows with the viewport rather than staying phone-sized on a
     desktop — 'theme.ts' records the same finding for '.ds-row': ours measured 0.60x the
     reference's row height and the fix was the row, not the type inside it. The floor is
     what the 44px tap rule and the six-rows-in-547px portrait band both need. */
  min-height: clamp(64px, 8.5vh, 88px);
  padding: 6px 10px;
  border-radius: var(--ds-r-2);
  background: rgba(26,18,36,0.06);
}
/* Your own seat is the one the eye should find first in a list of six near-identical
   rows. A left rule rather than a fill: a filled row would read as "selected", which is a
   state this list does not have. */
.fa-lobby .lobby-seat.is-you {
  background: rgba(244,163,0,0.16);
  box-shadow: inset 3px 0 0 var(--mustard);
}

.fa-lobby .lobby-seat-pic {
  flex: 0 0 auto;
  display: inline-flex;
  font-size: 44px;
  line-height: 1;
}

.fa-lobby .lobby-seat-body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1px;
}
.fa-lobby .lobby-seat-name {
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-black);
  font-size: clamp(0.9rem, 2.2vh, 1.05rem);
  line-height: 1.1;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* 'You' / 'Bot' is the load-bearing word on this screen, so it is bold inside a line that
   is otherwise quiet. 0.72 opacity on ink over the cream panel measures well clear of AA;
   the '<b>' inherits it and stays the darkest thing in the line by weight. */
.fa-lobby .lobby-seat-tag {
  font-family: 'Heebo', sans-serif;
  font-size: clamp(0.72rem, 1.7vh, 0.85rem);
  line-height: 1.15;
  color: rgba(26,18,36,0.78);
}
.fa-lobby .lobby-seat-tag b { font-family: 'Rubik', sans-serif; font-weight: var(--ds-w-bold); }

.fa-lobby .lobby-seat-act { flex: 0 0 auto; }

/* ── The count row + the CTA ───────────────────────────────────────────────── */
.fa-lobby .lobby-bottom {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--gap);
  flex-wrap: wrap;
}
.fa-lobby .lobby-count {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.fa-lobby .lobby-count-title { color: var(--cream); text-shadow: 0 2px 0 rgba(26,18,36,0.55); }
.fa-lobby .lobby-count-opts { display: flex; gap: 8px; }

/* Square, sized from CSS, never from the digit inside it — see the drift note in the TS. */
.fa-lobby .lobby-opt {
  width: var(--tap);
  min-width: var(--tap);
  height: var(--tap);
  min-height: var(--tap);
  padding: 0;
  font-size: var(--ds-t4);
  border-radius: var(--ds-r-2);
  background: linear-gradient(180deg, #FFFFFF 0%, #EFE2CC 100%);
  --ds-lip: rgba(0,0,0,0.35);
}
/* The selected count. Mustard is the product's "this is the live one" colour (the tab
   bar's active state and the primary CTA both use it), so the row reads as state without
   a legend. */
.fa-lobby .lobby-opt.is-on {
  background: linear-gradient(180deg, var(--mustard-hi) 0%, var(--mustard) 100%);
  --ds-lip: var(--gold-shadow);
  transform: translateY(-1px);
}

/* ── TWO COLUMNS WHEN THERE IS ROOM, AND IT IS THE LANDSCAPE PHONE THAT NEEDS IT ──
   At 844x390 — the shape 'DECISIONS §14' says the game is played in — one column fits
   THREE seats and silently scrolled the fourth out of view under a simulated notch. A
   list that says "Players 4" and shows three is the same class of defect as a number the
   model does not compute, even though nothing is technically wrong. Two columns puts six
   seats in three rows: ~210px, which the band holds without a notch and very nearly with
   one. 760px is the breakpoint because a column needs ~360px to hold a 44px portrait, a
   name and a 44px control without ellipsising the name. */
@media (min-width: 760px) {
  .fa-lobby .lobby-seats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

/* The footer stacks before it squeezes. On a 360px phone the primary CTA and a five-way
   segmented control cannot share a line, and a CTA that has shrunk to fit is a CTA that
   has stopped being the loudest thing on the screen. */
@media (max-width: 700px) {
  /* The topbar chip goes, and the SCREEN'S NAME stays. At 360px the row was over budget
     and the title ellipsised to "Match L…" — a screen whose own heading is truncated.
     The chip is the redundant one: the identical number is on the segmented control
     directly above the CTA, highlighted, at every width. Measured before this: Back 72 +
     title + chip ~100 + gaps over 332px of usable width. */
  .fa-lobby .fa-topbar > .fa-chip { display: none; }
  .fa-lobby .lobby-bottom { flex-direction: column; align-items: stretch; }
  .fa-lobby .lobby-count-opts { justify-content: space-between; }
  .fa-lobby .lobby-start { width: 100%; }
}
`;
