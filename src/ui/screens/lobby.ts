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
 * "sets it up on the lobby" half.
 *
 * ── 5·0. 🚨 THIS SECTION USED TO DESCRIBE CODE THAT DID NOT EXIST, AND THAT IS
 *          KEPT AT THE TOP BECAUSE IT IS THE LESSON ────────────────────────
 * `d558cca` added **80 lines to this file and not one executable statement**: sixty
 * lines of §5 prose in the past tense (*"`LOADOUT_KEY` below"*, *"the two functions
 * below"*, *"that sentence is on the screen (`MATCH_READS_LOADOUT`)"*), eight imports
 * of symbols nothing referenced, and a `__faOwnedItems` global no code read. It cited
 * **`tools/tmp/il_seam.mjs`** and **`tools/tmp/il_accept.mjs`** six times across three
 * files. Neither file has ever existed in this repo. `tsconfig.json` sets
 * `noUnusedLocals: false`, so eight dead imports were not even a warning.
 *
 * ⚠️ **A HEADER IS NOT A MEASUREMENT AND IT IS NOT AN IMPLEMENTATION.** Everything §5
 * claimed was *correct design* — the storage argument below is re-derived and still
 * holds — and every word of it was *false as a description of the file*. The whole of
 * `CLAUDE.md`'s standing rule applies to a file's own comments before it applies to
 * anything else: re-derive what you are handed. The tools are now written, under this
 * pass's own prefix (`ul_`), and every claim below is a row in one of them.
 *
 * ── 5a. THE EQUIPPED PAIR LIVES IN ITS OWN `localStorage` KEY ──────────────
 * The right home is `EconomyState`, beside `unlocked` and `levels` — and
 * `economy/state.ts:EconomyState.items` **says so itself**, in a 🔴 REPORTED note that
 * names this screen. Neither that file nor `profile.ts` is in this pass's owned set, so
 * this pass cannot put it there.
 *
 * ⚠️ And *"just add a key to the profile blob"* is not available either. **Re-derived,
 * not inherited:** `profile.ts:commit()` (grep `private commit`) serialises a FIXED
 * SIX-FIELD OBJECT — `name`, `wins`, `losses`, `xp`, `selected`, `economy` — over
 * `food-arena.profile.v1`. A seventh key written into that blob from outside is
 * destroyed by the next profile write, i.e. by every rename, every match result and
 * every level purchase. `economy/state.ts:serialize` is the same fixed shape one level
 * down. A loadout stored in either would survive exactly until the player did anything.
 *
 * So: `LOADOUT_KEY`, read and written only here, with `loadEquipped`/`saveEquipped`
 * exported so the match side gets one function to call rather than a storage format to
 * copy. **This is a LODGER and the eviction plan is a red row, not a memory**:
 * `ul_seam.mjs` §S1 fails the day `EconomyState` grows an equipped field, because on
 * that day this key becomes a second source of truth.
 *
 * ── 5b. WHAT YOU OWN IS READ FROM THE ECONOMY, NEVER INVENTED HERE ─────────
 * `ownedItems()` calls `economy/state.ts:ownedItemSet`. ⚠️ **The old §5b said *"nothing
 * in the shipped tree grants an item, so every player owns none"*. That was true when it
 * was typed and false when it was committed** — `d558cca` merged the acquisition track
 * in the same commit. `createEconomy()` seeds `items: [STARTER_ITEM]`, and `STARTER_ITEM`
 * resolves to the first member of the cheapest non-empty tier, so **a brand-new player
 * owns exactly one item and never zero**. The zero-owned state is still rendered and
 * still rendered because a defensive read must survive a hand-edited blob, but it is NOT
 * what a screenshot of a new player shows.
 *
 * 🚨 **THIS SENTENCE SAID *"still tested (`ul_accept.mjs` arm `own0`)"* AND
 * `tools/tmp/ul_accept.mjs` HAS NEVER EXISTED ON ANY BRANCH** (`git log --all --
 * tools/tmp/ul_accept.mjs` is empty, re-derived 2026-09-02). Four citations of it were
 * committed in `a80f69b` — **the same commit whose §5·0 above spends fifteen lines
 * condemning `il_seam.mjs` for being cited six times and never existing.** The word
 * "tested" is doing the work here and there is no test; the zero-owned arm is rendered
 * and unmeasured. Corrected rather than deleted, per the reversal rule, because the
 * lesson is that a citation is what made the claim *look* verified — twice, in one file,
 * in one session, by the person who had just written the lesson.
 *
 * ── 5c. THE HONESTY LINE, AND WHY THE SLOTS ARE *NOT* `disabled` ───────────
 * §1 disables the multiplayer control because pressing it could do nothing. Equipping is
 * not that: the press does the whole of what it claims and the choice survives a reload.
 * What is **not** yet true is downstream of this screen, and it is two separate facts,
 * both derived from the tree by `ul_seam.mjs` rather than remembered:
 *
 *   `LOADOUT_REACHES_MATCH`     `matchScreen.ts` → `startGame` → `FighterConfig.items`.
 *                               ⚠️ **WAS FALSE — *"`GameSessionOptions` has no items
 *                               field"*. TRUE since 2026-09-02**: the option exists, the
 *                               screen calls `loadEquipped`, and `newMatch` seats it on
 *                               BOTH the duel and the 3..6 roster path. Old wording kept
 *                               per the reversal rule; the constant's own header carries
 *                               the whole of it.
 *   `PLAYER_CAN_PRESS_AN_ITEM`  something writes `FighterInput.useItem`.
 *                               **FALSE, still.** `grep -rn useItem src/` writes it
 *                               NOWHERE; `sim.ts` reads it in one place. Bots press items
 *                               through `ai.ts` → `attemptItem`; the human has no button.
 *
 * `loadoutNote()` turns those two booleans into the one sentence on the screen, so the
 * sentence cannot outlive the fact. Disabling the slots instead would make the feature
 * unreachable in order to describe it, which is strictly worse than describing it.
 *
 * ⚠️ **AND THE SENTENCE CHANGED WHEN THE FACT DID, WITHOUT ANYONE EDITING A STRING** —
 * which is the only reason this shape was worth the two constants. It now reads *"Your
 * picks go into the match now. Active items have no button yet, so only an item that needs
 * no press can fire."*
 *
 * 🚨 …and the wording of THAT sentence was then corrected too, because the obvious version
 * (*"Passive items work in a match"*) is FALSE: `blue_cheese` is a passive that does
 * nothing, measured by `us_bitid --census`. See `loadoutNote()` for the whole of it. **Two
 * constants make the sentence's TIMING automatic; they do not make its CONTENT true.**
 *
 * ── 5d. THE PICKER LISTS ALL TEN, INCLUDING THE ONES YOU DO NOT OWN ────────
 * ⚠️ Deliberate, and adjacent to the defect class §1 spends fifty lines on, so it is
 * argued rather than assumed. The shop's *"Epic or better"* was a promise about a BENEFIT
 * that did not exist. A row reading **"Not owned yet"** claims only that the item exists
 * in the game, which `rules.ts:ITEMS` makes true, and it carries `disabled` plus the
 * reason on both `title` and `aria-label` — `shop.ts`'s precedent. The alternative, a
 * picker that renders nothing for a player who owns one item of ten, is a control that
 * does nothing, which is the defect §1 actually names.
 *
 * ── 5e. NOTHING IS EQUIPPED BY DEFAULT ────────────────────────────────────
 * A new player owns `STARTER_ITEM` and auto-equipping it is tempting. It is refused:
 * with an auto-equip, *"I chose this"* and *"I never opened this screen"* are the same
 * state, and Uri's sentence is *"which ones he wants to use"* — a choice. The
 * discoverability cost is paid in the empty slot, which is a 44 px mustard control
 * reading **Add item**, not in a silent default.
 */

import {
  CHARACTER_IDS, CHARACTERS, ITEMS, ITEM_SLOTS, RARITY_COLORS, RARITY_ORDER,
  type CharacterId, type ItemDef, type ItemId,
} from '../../game/rules';
import {
  ITEM_IDS, ITEM_TEST_GRANT_ALL, enemyLevelFor, ownedItemSet, type EconomyState,
} from '../../game/economy';
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
     * A brand-new player owns exactly ONE item (`createEconomy` seeds `STARTER_ITEM`), so
     * the interesting arms — owns NOTHING, owns ALL TEN, owns more than fits in
     * `ITEM_SLOTS` — are all unreachable from the shipped faucet inside one test run.
     * Without an injection every row about a full picker would be asserted over a
     * one-element set, and the zero-owned row over an empty one, where `[].every()` is
     * `true` — the failure mode `CLAUDE.md` rule 6 records firing three times in three
     * files in one session. Costs one property read per render.
     *
     * ⚠️ **NO TOOL SETS THIS TODAY.** This said *"`tools/tmp/ul_accept.mjs` sets this per
     * arm and requires the screen to MOVE between them"*, and that file has never
     * existed — see §5b's correction. The hook is real and works; what is missing is the
     * consumer. `tools/tmp/us_loadout.mjs` uses the sibling hook it does need
     * (`localStorage` + `?items=`) and does NOT exercise this one, so the picker's
     * own-nothing / own-all arms remain **unmeasured** rather than fictitiously measured.
     *
     * ⚠️ **`[]` IS A REAL VALUE HERE AND `null` IS NOT.** An empty array is truthy, so
     * `__faOwnedItems = []` is the own-nothing arm; `null`/`undefined` means "no
     * injection, read the real economy". A `.length` test instead of a truthiness test
     * would silently collapse those two into one and the own-nothing arm would measure
     * the shipped economy while printing a tick.
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

/* ═══════════════════════════════════════════════════════════════════════════
   THE LOADOUT — model, storage, and the two facts the screen must not outlive
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Where the equipped pair lives. Header §5a argues the location; this is the key.
 *
 * ⚠️ **`.v1` IS NOT DECORATION.** The day this moves onto `EconomyState`, `deserialize`
 * adopts this key once and then it is dead. A version in the name is what makes
 * "adopted" distinguishable from "never written".
 */
const LOADOUT_KEY = 'food-arena.loadout.v1';

/**
 * Read the equipped pair, FILTERED BY WHAT THE PLAYER OWNS.
 *
 * 🚨 **TOTAL, AND THAT IS A SAFETY REQUIREMENT RATHER THAN TIDINESS.**
 * `state.ts:validateLoadout` **THROWS** — `RangeError` — on a loadout that is over-full,
 * duplicated, or names an id `ITEMS` does not contain. It is called from `createFighter`,
 * i.e. from inside `createMatch`. So the day §5c's wiring lands, a hand-edited or
 * stale `localStorage` blob would not degrade to "no items"; it would **fail to start the
 * match**, from a screen with no error surface. Every hostile shape is therefore filtered
 * here, where the cost is one missing icon:
 *
 *   not a string · not an `ItemId` · not owned · a duplicate · past `ITEM_SLOTS`
 *
 * plus `localStorage` itself throwing (private-mode Safari — `profile.ts` records the
 * same) and `JSON.parse` throwing on a truncated write.
 *
 * ⚠️ **`owned` IS A PARAMETER, NOT A LOOKUP.** This function is exported for the match
 * side, which holds the profile; making it read the economy itself would put a second
 * ownership read in a second module and they would drift.
 */
export function loadEquipped(owned: ReadonlySet<ItemId>): ItemId[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(LOADOUT_KEY); } catch { return []; }
  if (raw === null) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(parsed)) return [];
  const out: ItemId[] = [];
  for (const v of parsed) {
    if (out.length >= ITEM_SLOTS) break;
    if (typeof v !== 'string' || !isItemId(v) || !owned.has(v) || out.includes(v)) continue;
    out.push(v);
  }
  return out;
}

/** Write the equipped pair. Never throws — private-mode Safari costs persistence, not the screen. */
export function saveEquipped(ids: readonly ItemId[]): void {
  try { localStorage.setItem(LOADOUT_KEY, JSON.stringify(ids.slice(0, ITEM_SLOTS))); } catch { /* private mode */ }
}

/**
 * Is this string one of the ten?
 *
 * `ITEM_IDS` is `Object.keys(ITEMS)` in `economy/tuning.ts` and `economy.test.mjs` §14
 * asserts it against the registry, so this is the registry's own membership test rather
 * than a second list. An eleventh item is in it the day `rules.ts` declares one.
 */
function isItemId(v: string): v is ItemId {
  return (ITEM_IDS as readonly string[]).includes(v);
}

/**
 * What the player owns. `ownedItemSet` is `economy/state.ts`'s own function, never a
 * re-read of the array — see the note on `EconomyState.items`: it is a SET, not an
 * inventory, and the set is the only shape the picker may reason about.
 *
 * 🚨 **EXPORTED, AND IT HAD TO BE, BECAUSE `loadEquipped` TAKES `owned` AS A PARAMETER.**
 * `matchScreen.ts` is the second caller of `loadEquipped` and it holds the same profile
 * this screen does — but if it built its own owned set from `ownedItemSet` alone it would
 * miss BOTH overrides below, and the failure would be silent and specific: with
 * `ITEM_TEST_GRANT_ALL` on, Uri equips any of the ten here, and `loadEquipped` on the
 * match side filters every one of them out as "not owned". The loadout screen would work,
 * the match would start, and no item would ever arrive. **One ownership expression, one
 * place**, exactly the argument `loadEquipped`'s own header makes for taking a parameter.
 *
 * ⚠️ Takes the `EconomyState`, not the `ScreenContext` — `matchScreen.ts` has the former
 * and the latter would drag a screen's whole context into a function about a set of ids.
 */
export function ownedItems(economy: EconomyState): ReadonlySet<ItemId> {
  const injected = window.__faOwnedItems;
  // Truthiness, NOT `.length` — see the declaration above: `[]` is the own-nothing arm.
  if (injected) return new Set(injected.filter(isItemId));
  // 🚨 TESTING POSTURE, AND IT IS APPLIED **HERE** RATHER THAN IN THE ECONOMY — 2026-09-02
  //
  // Uri: *"Make sure that i have all items now so i can test it, later we'll deal with
  // user accounts and each will have their level and progress. for now open everything."*
  //
  // ⚠️ THE FIRST ATTEMPT PUT THIS IN `economy/state.ts` AND SEVEN CHECKS WENT RED. They
  // were RIGHT to. `createEconomy` and `deserialize` define what a player has EARNED, and
  // the suite asserts that model hard — "a brand-new player owns exactly the starter
  // item", "a save that predates items reads back owning exactly the starter", the
  // round-trips. Granting there does not open a door, it rewrites the ledger, and every
  // one of those rows exists to stop exactly that.
  //
  // ⚠️ AND `ownedItemSet` IS NOT THE SEAM EITHER, though it looks like one because
  // `ROSTER_GATED` works that way for characters. Its own header says why: it is "the set
  // every item reward path tests against", so overriding it would silently convert every
  // item drop into duplicate coins — the feature would become unearnable at the same
  // moment it became free, which is the exact failure that header warns about.
  //
  // So the grant lives at the SCREEN. The economy stays truthful, every acquisition test
  // keeps passing, the boxes still hand over real items, and the picker shows all ten.
  // One line to revert when accounts land.
  if (ITEM_TEST_GRANT_ALL) return new Set(ITEM_IDS);
  return ownedItemSet(economy);
}

/**
 * **DOES A MATCH READ THIS LOADOUT? YES, SINCE 2026-09-02 — BOTH HOPS ARE CLOSED.**
 *
 * ⚠️ **THIS CONSTANT SAID `false` AND THE COMMENT ABOVE IT SAID "NO". THE OLD WORDING IS
 * KEPT BELOW PER `CLAUDE.md`'s reversal rule**, because it is the record of what was
 * missing and it named the two hops correctly:
 *
 * > 🚨 **DOES A MATCH READ THIS LOADOUT? NO. AND THIS CONSTANT IS THE ONLY HONEST PLACE
 * > TO SAY SO.** … The two missing hops are:
 * >   1. `GameSessionOptions` (`match.ts`) has no `items` field, and `newMatch` builds
 * >      every `FighterConfig` without one — including the duel path, which is what
 * >      `seatCountFor(MIN_FIGHTERS)` routes to and therefore the shipped default.
 * >   2. `matchScreen.ts` never calls `loadEquipped`.
 * > **Both files are outside this pass's owned set** … It is REPORTED to the orchestrator
 * > with the exact hunks, and `ul_seam.mjs` §W fails the moment either lands while this
 * > constant still says `false` — so the screen cannot go on apologising for a limitation
 * > that has been fixed.
 *
 * That last sentence is what happened: §W is a two-way row, and flipping this without the
 * wiring goes red exactly as fast as landing the wiring without flipping this.
 *
 * The chain is `lobby → localStorage → matchScreen.ts:startGame → GameSessionOptions →
 * match.ts:newMatch → FighterConfig.items → state.ts:createFighter → Fighter.item.equipped`,
 * and every link is now real:
 *
 *   1. `GameSessionOptions.items` exists, `GameSession` sanitises it once, and `newMatch`
 *      puts it on the LOCAL seat's `FighterConfig` **on both paths** — the 3..6 roster and
 *      the duel. The duel mattered most: `seatCountFor(MIN_FIGHTERS)` maps 2 to
 *      `seats: undefined`, so a six-seat-only fix would have left the shipped default dead
 *      while looking finished.
 *   2. `matchScreen.ts` calls `loadEquipped(ownedItems(ctx.profile.economy))` — the same
 *      ownership expression this screen equips through, which is why `ownedItems` is
 *      exported rather than duplicated.
 *
 * ⚠️ **WHAT THIS CONSTANT DOES NOT CLAIM.** It says the equipped ids ARRIVE on
 * `Fighter.item.equipped`. It does not say every effect is visible: `PLAYER_CAN_PRESS_AN_ITEM`
 * below is still `false`, so today the arrival buys you the three that need no press —
 * `tenderiser`, `blue_cheese` (passive) and `leftovers` (triggered) — and the seven actives
 * sit equipped and unpressed. `loadoutNote()` composes exactly that sentence.
 *
 * Measured, not asserted: `tools/tmp/us_loadout.mjs` boots the shipped screen at two seats
 * and at six and reads `__matchDebug.loadouts` — the sim's own `Fighter.item.equipped`,
 * not the option that was passed in.
 */
const LOADOUT_REACHES_MATCH = true;

/**
 * 🚨 **CAN THE PLAYER PRESS AN ACTIVE ITEM? NO — AND NOTHING ELSE ON THIS SCREEN MAY
 * IMPLY OTHERWISE.**
 *
 * `state.ts:FighterInput.useItem` is READ in exactly one place (`sim.ts`, the human
 * branch) and **WRITTEN NOWHERE IN `src/`** — not by `input.ts`, not by `touch.ts`, not
 * by `hud.ts`. Verified by census, not by memory: `grep -rn useItem src/` returns two
 * hits in `sim.ts` and two in `state.ts`, all of them the declaration or the read.
 *
 * Bots are unaffected: `ai.ts:stepAI` calls `combat.ts:attemptItem` directly. So today a
 * bot can use all ten and the player can use the three that need no press — `tenderiser`
 * and `blue_cheese` (passive) and `leftovers` (triggered).
 *
 * ⚠️ **THIS IS WHY NO LABEL ON THIS SCREEN SAYS "TAP TO USE".** `kindLabel()` prints
 * `ItemKind` — *Active*, *Passive*, *Triggered* — which describes the ITEM. "Tap to use"
 * would describe a BUTTON, and this project's most expensive recorded defect class is a
 * UI sentence asserting something the model does not do.
 */
const PLAYER_CAN_PRESS_AN_ITEM = false;

/**
 * The one sentence under the slots, composed from the two facts above rather than typed.
 *
 * Ordered worst-first: if a match does not read the loadout at all, whether an item can
 * be pressed is not the player's problem yet. Empty string when both are true, and
 * `renderKit` hides the element on empty — so the note disappears by itself.
 */
function loadoutNote(): string {
  if (!LOADOUT_REACHES_MATCH) {
    return 'Your picks are saved and survive a reload. A match does not read them yet.';
  }
  if (!PLAYER_CAN_PRESS_AN_ITEM) {
    // 🚨 THIS STRING SAID *"Passive items work in a match. There is no button for firing an
    // active one yet."* AND THE FIRST HALF WAS MEASURABLY FALSE THE HOUR IT APPEARED.
    // Kept above the correction per the reversal rule.
    //
    // `tools/tmp/us_bitid.mjs --census` equips each of the ten in turn and asks whether the
    // sim MOVES (2026-09-02, blind differ, 8 matchups x 2 seeds at n=2 and 4 x 1 at n=6):
    // **`blue_cheese` is dead in every column at every seat count.** It is a passive, it is
    // equipped, and it does nothing — `combat.ts`'s switch sends it to *"`sim.ts`'s aura
    // block"* and there is no aura block; `sim.ts` imports `ITEM_AURA_TICK_MS`,
    // `itemDamageSource` and `hasItem` and calls none of them. So "passive items work" was
    // exactly the UI-asserts-what-the-model-does-not-do defect §1 spends fifty lines on,
    // written by the file that spends fifty lines on it. Reported; `sim.ts` is not this
    // pass's file to fix.
    //
    // The replacement is a claim about the BUTTON — which is what this screen owns and
    // what `PLAYER_CAN_PRESS_AN_ITEM` actually measures — and says nothing about which
    // effects are implemented, because this file cannot know that and must not guess.
    return 'Your picks go into the match now. Active items have no button yet, so only an '
      + 'item that needs no press can fire.';
  }
  return '';
}

/** Where items come from. Asserted against the economy by `ul_seam.mjs` §S3, not remembered. */
const ITEM_SOURCE_LINE = 'Items come from boxes and from the trophy road.';

/** `ItemKind` as a player-facing word. Describes the ITEM, never a control — see above. */
function kindLabel(kind: ItemDef['kind']): string {
  return kind === 'passive' ? 'Passive' : kind === 'triggered' ? 'Triggered' : 'Active';
}

/**
 * The second line of a picker row: how it is used, and the two gates on using it.
 *
 * Every part is read off `ITEMS`. The cooldown is printed from `cooldownMs`, so a re-tune
 * in `rules.ts` moves this string; `minAlive` is printed ONLY where it exceeds the
 * smallest match this product plays, which is `MIN_FIGHTERS` — otherwise nine rows would
 * carry a "needs 2 fighters" clause that is true of every match ever played and therefore
 * tells the player nothing.
 */
function itemMeta(def: ItemDef): string {
  const parts = [kindLabel(def.kind)];
  if (def.cooldownMs !== null) parts.push(`${+(def.cooldownMs / 1000).toFixed(1)} s cooldown`);
  else if (def.kind === 'passive') parts.push('always on');
  else parts.push('once a match');
  if (def.minAlive > MIN_FIGHTERS) parts.push(`needs ${def.minAlive} fighters alive`);
  return parts.join(' · ');
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
      <section class="fa-panel lobby-kit" aria-labelledby="lobby-kit-label">
        <div class="lobby-kit-head">
          <span class="fa-panel-title" id="lobby-kit-label">Your items</span>
          <span class="lobby-kit-owned ds-num" data-el="kit-owned"></span>
        </div>
        <div class="lobby-kit-slots" data-el="kit-slots"></div>
        <p class="lobby-kit-note" data-el="kit-note"></p>
      </section>
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

    <!-- ── THE PICKER ────────────────────────────────────────────────────────
         🚨 SINGLE QUOTES IN HERE, NEVER BACKTICKS. This comment is inside a TEMPLATE
         LITERAL and a backtick TERMINATES it — the trap 'a015d1f' held the whole items
         branch red on, with tsc parsing the rest of the file as something else. Writing
         it in house style cost this pass one red compile too.

         Inside the screen root rather than on <body>: 'dispose()' removes the root and
         everything in it, and a sheet parented anywhere else is a leak the router cannot
         see. 'hidden' while closed, which is what keeps its ten rows out of
         'menu_accept''s control census (that battery filters on a NON-ZERO rect).

         WAS: '— they are measured instead by ul_accept.mjs, which opens it first.'
         That file has never existed (see the correction in section 5b). The ten rows are
         therefore measured by NOTHING while the sheet is closed, which is a real gap and
         is now stated as one rather than covered by a citation. -->
    <div class="lobby-sheet" data-el="sheet" hidden role="dialog" aria-modal="true"
         aria-labelledby="lobby-sheet-title">
      <div class="lobby-sheet-scrim" data-el="sheet-scrim"></div>
      <div class="fa-panel lobby-sheet-card">
        <header class="lobby-sheet-head">
          <h2 class="fa-panel-title lobby-sheet-title" id="lobby-sheet-title">Choose an item</h2>
          <button class="fa-iconbtn lobby-sheet-x" type="button" data-el="sheet-x"
                  aria-label="Close the item picker">${icon('close')}</button>
        </header>
        <p class="lobby-sheet-sub" data-el="sheet-sub"></p>
        <div class="fa-scroll lobby-sheet-list" data-el="sheet-list"></div>
      </div>
    </div>
  `;

  const q = <T extends HTMLElement>(sel: string): T => {
    const node = root.querySelector<T>(`[data-el="${sel}"]`);
    if (!node) throw new Error(`lobby: missing element "${sel}"`);
    return node;
  };

  const seatsEl = q<HTMLDivElement>('seats');
  const optsEl = q<HTMLDivElement>('opts');
  const noteEl = q<HTMLParagraphElement>('note');
  const slotsEl = q<HTMLDivElement>('kit-slots');
  const kitNoteEl = q<HTMLParagraphElement>('kit-note');
  const kitOwnedEl = q<HTMLSpanElement>('kit-owned');
  const sheetEl = q<HTMLDivElement>('sheet');
  const sheetListEl = q<HTMLDivElement>('sheet-list');
  const sheetSubEl = q<HTMLParagraphElement>('sheet-sub');

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

  // ── The loadout ────────────────────────────────────────────────────────────

  /**
   * What this player owns, read ONCE per mount.
   *
   * Same argument `openSeat` makes six lines above: two reads could disagree with each
   * other inside one render pass, and the picker's "not owned" reason would then be
   * describing a different set from the one the slot was filled out of. Nothing on this
   * screen can grant an item, so there is nothing to invalidate.
   */
  const owned = ownedItems(ctx.profile.economy);

  /**
   * The equipped pair. Loaded through the filter, so a stale id for an item this player
   * no longer owns is gone before it is ever rendered — and is written back on the next
   * save rather than lingering in storage.
   */
  let equipped: ItemId[] = loadEquipped(owned);

  /** Which slot the picker is filling, or `null` when it is closed. */
  let pickingSlot: number | null = null;

  /**
   * The picker's order: **what you can equip first**, then the rest by rarity.
   *
   * Registry order would put `springform` — the one item a new player actually owns —
   * second, behind a Legendary they cannot have. Owned-first is the only ordering where
   * the top of the list is the part of it that does anything. Inside each group the sort
   * is `RARITY_ORDER`, which is `tuning.ts`'s own weight ladder (`ITEMS.md` derives it
   * from the box weights), so "closest to reachable" comes first among the locked rows.
   * `ITEM_IDS`'s own order breaks ties, so the list is stable rather than
   * implementation-defined.
   */
  function pickerOrder(): ItemId[] {
    const rank = (id: ItemId): number => RARITY_ORDER.indexOf(ITEMS[id].rarity);
    return [...ITEM_IDS].sort((a, b) => {
      const oa = owned.has(a) ? 0 : 1;
      const ob = owned.has(b) ? 0 : 1;
      if (oa !== ob) return oa - ob;
      const ra = rank(a) - rank(b);
      if (ra !== 0) return ra;
      return ITEM_IDS.indexOf(a) - ITEM_IDS.indexOf(b);
    });
  }

  /**
   * The rarity chip. `.fa-rarity` is the SHARED component, not a local copy.
   *
   * ⚠️ That is a contrast decision, not a tidiness one. `theme.ts` measured this badge at
   * **16.52–16.54:1 on all six rarities** across two screens and three viewports
   * (`tools/tmp/rarity_aa.mjs`) — cream fill, 1.6 px ink stroke, `paint-order: stroke
   * fill` — precisely because ink on `RARITY_COLORS.Epic` alone is 3.69:1. A local chip
   * that set `color: var(--ink)` over the same fills would look right and re-open a
   * measured defect. Anything that draws a rarity uses this class.
   */
  function rarityChip(rarity: ItemDef['rarity'], cls: string): string {
    return `<span class="fa-rarity ${cls}" style="background:${RARITY_COLORS[rarity]}">${rarity}</span>`;
  }

  /** One equip slot: filled, or the empty control that opens the picker. */
  function slotMarkup(slot: number): string {
    const id = equipped[slot];
    const n = slot + 1;
    if (id === undefined) {
      const why = owned.size === 0
        ? `Slot ${n}: empty. You do not own any items yet.`
        : `Slot ${n}: empty. Choose an item.`;
      return `
        <button class="lobby-slot is-empty" type="button" data-el="slot" data-slot="${slot}"
                title="${why}" aria-label="${why}">
          <span class="lobby-slot-plus" aria-hidden="true">+</span>
          <span class="lobby-slot-txt"><span class="lobby-slot-name">Add item</span></span>
        </button>`;
    }
    const def = ITEMS[id];
    // 🚨 THE SEAT COUNT IS PART OF THE ANSWER. `disposal` declares `minAlive: 3`, and
    // `combat.ts:itemUsable` refuses it below that — so at the seat count selected two
    // controls away it is an equipped item that can never fire. Saying so is the same
    // rule §1 applies to the join button: the model's gate, on the screen, in words.
    const dead = seats < def.minAlive;
    const label = `Slot ${n}: ${def.name}, ${def.rarity}. ${def.blurb}`
      + `${dead ? ` Needs ${def.minAlive} fighters; this match has ${seats}.` : ''} Change it.`;
    return `
      <button class="lobby-slot is-filled${dead ? ' is-dead' : ''}" type="button"
              data-el="slot" data-slot="${slot}" title="${label}" aria-label="${label}">
        <span class="lobby-slot-ic">${icon(id)}</span>
        <span class="lobby-slot-txt">
          <span class="lobby-slot-name">${def.name}</span>
          ${rarityChip(def.rarity, 'lobby-slot-rar')}
        </span>
      </button>`;
  }

  function renderKit(): void {
    slotsEl.innerHTML = Array.from({ length: ITEM_SLOTS }, (_, i) => slotMarkup(i)).join('');
    // "1 of 10" — both numbers from the model. `ITEM_IDS.length` rather than a typed ten,
    // so an eleventh item counts itself.
    kitOwnedEl.textContent = `${owned.size} of ${ITEM_IDS.length} owned`;
    // Owning nothing is a different sentence from the wiring caveat, and it is the one a
    // player in that state needs: it says where items come from. It REPLACES the caveat
    // rather than stacking with it — two apologies under one control is noise.
    const note = owned.size === 0 ? ITEM_SOURCE_LINE : loadoutNote();
    kitNoteEl.textContent = note;
    kitNoteEl.hidden = note === '';
    // A dead slot's warning cannot live on the slot chip (there is no room for a sentence
    // at 360 px), so it lives here, where the note already is.
    const dead = equipped.filter((id) => seats < ITEMS[id].minAlive);
    if (dead.length > 0) {
      kitNoteEl.textContent = dead
        .map((id) => `${ITEMS[id].name} needs ${ITEMS[id].minAlive} fighters alive; this match has ${seats}.`)
        .join(' ');
      kitNoteEl.hidden = false;
    }
  }

  /** One picker row. Owned rows are controls; the rest are `disabled` with the reason on both attributes. */
  function itemRowMarkup(id: ItemId): string {
    const def = ITEMS[id];
    const have = owned.has(id);
    const at = equipped.indexOf(id);
    const state = !have ? 'Not owned yet' : at >= 0 ? `In slot ${at + 1}` : 'Equip';
    // `shop.ts`'s precedent: the reason goes on `title` (pointer) AND `aria-label` (touch,
    // where there is no hover and a tooltip is unreachable).
    const reason = !have ? ' You do not own this item yet.' : '';
    const label = `${def.name}, ${def.rarity}. ${def.blurb} ${itemMeta(def)}.${reason}`;
    return `
      <button class="lobby-item${have ? '' : ' is-locked'}${at >= 0 ? ' is-on' : ''}" type="button"
              data-item="${id}"${have ? '' : ' disabled'}
              title="${label}" aria-label="${label}">
        <span class="lobby-item-ic">${icon(id)}</span>
        <span class="lobby-item-body">
          <span class="lobby-item-top">
            <span class="lobby-item-name">${def.name}</span>
            ${rarityChip(def.rarity, 'lobby-item-rar')}
          </span>
          <span class="lobby-item-blurb">${def.blurb}</span>
          <span class="lobby-item-meta">${itemMeta(def)}</span>
        </span>
        <span class="lobby-item-state">
          ${!have ? icon('lock') : at >= 0 ? icon('check') : ''}<span>${state}</span>
        </span>
      </button>`;
  }

  function renderSheet(): void {
    if (pickingSlot === null) return;
    const current = equipped[pickingSlot];
    sheetSubEl.textContent = owned.size === 0
      ? `You own none of these ${ITEM_IDS.length} yet. ${ITEM_SOURCE_LINE}`
      : current === undefined
        ? `Slot ${pickingSlot + 1} of ${ITEM_SLOTS}. Pick one of the ${owned.size} you own.`
        : `Slot ${pickingSlot + 1} of ${ITEM_SLOTS} holds ${ITEMS[current].name}. Pick another, or take it out.`;
    const rows = pickerOrder().map(itemRowMarkup).join('');
    // ⚠️ The "take it out" control only exists when there is something to take out. A
    // permanent Clear button on an empty slot is a control that does nothing — §1's class.
    const clear = current === undefined ? '' : `
      <button class="ds-btn lobby-item-clear" type="button" data-el="clear"
              aria-label="Take ${ITEMS[current].name} out of slot ${pickingSlot + 1}">
        ${icon('close')} Take out ${ITEMS[current].name}
      </button>`;
    sheetListEl.innerHTML = rows + clear;
  }

  function openPicker(slot: number): void {
    pickingSlot = slot;
    renderSheet();
    sheetEl.hidden = false;
    // Focus the dialog's own close control: a sheet that opens with focus still on the
    // slot behind it is a keyboard trap in the wrong direction.
    q<HTMLButtonElement>('sheet-x').focus();
  }

  function closePicker(): void {
    const slot = pickingSlot;
    pickingSlot = null;
    sheetEl.hidden = true;
    // Focus returns to the control that opened it — the slot may have been re-rendered,
    // so it is re-queried rather than held.
    const back = slotsEl.querySelector<HTMLButtonElement>(`[data-slot="${slot}"]`);
    back?.focus();
  }

  /**
   * Equip `id` into the open slot.
   *
   * ── 🚨 THE ARRAY IS DENSE AND FILLS LEFT TO RIGHT, AND THAT IS A PERSISTENCE
   *      DECISION RATHER THAN A LAYOUT ONE ──────────────────────────────────
   * Writing into slot 1 while slot 0 is empty would leave a HOLE, and a hole does not
   * survive storage: `JSON.stringify([, 'springform'])` is `[null,"springform"]`,
   * `loadEquipped` drops the `null`, and the item the player put in the right-hand slot
   * comes back in the left-hand one. Rather than have the screen disagree with itself
   * across a reload, the slot index is CLAMPED to the array's length on the way in — so
   * filling the second slot first fills the first, visibly, immediately, and identically
   * before and after a reload.
   *
   * ── ⚠️ AN ITEM ALREADY IN THE OTHER SLOT MOVES, IT DOES NOT DUPLICATE ─────
   * `state.ts:validateLoadout` throws a `RangeError` on a duplicated loadout, from inside
   * `createFighter`, from inside `createMatch`. `[springform, springform]` is therefore
   * not a cosmetic bug; it is a match that refuses to start. Tapping an item that is
   * already carried SWAPS the two slots, which is also what a player means by it.
   */
  function equip(id: ItemId): void {
    if (pickingSlot === null || !owned.has(id)) return;
    const slot = Math.min(pickingSlot, equipped.length);
    const next = equipped.slice();
    const at = next.indexOf(id);
    if (at === slot) { closePicker(); return; }
    const outgoing = next[slot];
    if (slot < next.length) next[slot] = id; else next.push(id);
    if (at >= 0) {
      // It was already carried. Give its old slot whatever this one displaced, or drop
      // that slot entirely if this one was empty — exactly one copy either way.
      if (outgoing === undefined) next.splice(at, 1); else next[at] = outgoing;
    }
    equipped = next.slice(0, ITEM_SLOTS);
    saveEquipped(equipped);
    closePicker();
    renderKit();
  }

  function unequip(slot: number): void {
    equipped = equipped.filter((_, i) => i !== slot);
    saveEquipped(equipped);
    closePicker();
    renderKit();
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
    // AFTER the seat count, because a slot's "needs N fighters alive" warning is a
    // function of `seats` — changing the count with Disposal equipped must move the note.
    renderKit();
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
    // ── The loadout. Ordered before the generic handlers because the sheet sits on top
    //    of the screen and its own close controls must win.
    const slot = node?.closest<HTMLElement>('[data-el="slot"]');
    if (slot) { openPicker(Number(slot.dataset.slot)); return; }
    if (node?.closest('[data-el="clear"]')) {
      if (pickingSlot !== null) unequip(Math.min(pickingSlot, Math.max(0, equipped.length - 1)));
      return;
    }
    if (node?.closest('[data-el="sheet-x"]') || node?.closest('[data-el="sheet-scrim"]')) {
      closePicker();
      return;
    }
    const row = node?.closest<HTMLElement>('.lobby-item');
    if (row) {
      // Unreachable for a locked row — a `<button disabled>` emits no `click` — and
      // `equip` re-checks ownership anyway, because "the DOM said so" is not a model.
      const id = row.dataset.item;
      if (id !== undefined && isItemId(id)) equip(id);
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

  // Escape closes the picker. On the ROOT rather than on `document`: the shell mounts and
  // unmounts screens, and a document-level listener that outlived `dispose()` would close
  // a sheet that no longer exists — or worse, keep this closure alive holding the whole
  // screen. `settings.ts` uses the same shape.
  const onKey = (ev: KeyboardEvent): void => {
    if (ev.key === 'Escape' && pickingSlot !== null) { ev.stopPropagation(); closePicker(); }
  };
  root.addEventListener('keydown', onKey);

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
      root.removeEventListener('keydown', onKey);
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
.fa-lobby .lobby-kit,
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

/* ══ THE LOADOUT ══════════════════════════════════════════════════════════════
   🚨 THIS HEADER CLAIMED A MEASUREMENT THAT WAS NEVER TAKEN. IT READ:

     'EVERY SURFACE BELOW IS MEASURED AGAINST WCAG 2.1 SC 1.4.11's 3.0 FLOOR ON THE
      RENDERED PIXELS, NOT REASONED ABOUT. tools/tmp/ul_accept.mjs section C samples the
      real PNG through qx_contrast.mjs:boundaryContrast'

   'ul_accept.mjs' has never existed on any branch (re-derived 2026-09-02). So the
   strongest claim in this file — 'measured on rendered pixels, not reasoned about' — was
   itself reasoned about, and the citation is exactly what made it read as verified.

   That is the SAME SENTENCE 'tools/tmp/ul_seam.mjs's own header condemns 'il_seam.mjs'
   for: 'a measurement that was never taken, under a heading reading WHAT HAS AND HAS NOT
   BEEN MEASURED.' It was reproduced here in the commit that wrote the condemnation.

   WHAT IS ACTUALLY TRUE, and it is the DESIGN half rather than the measurement half:
   the match pause chip shipped working, at 1.026:1 against its own background, and that
   is the TWENTIETH rendering-and-invisible instance in this project and the FOURTH
   dark-on-dark. A control whose boundary is a 6%-alpha tint is exactly how the previous
   three looked in source. Hence full ink borders below rather than tinted fills — a
   reasoned defence against a known class, and NOT a contrast measurement. Nobody has
   sampled these pixels yet. */

.fa-lobby .lobby-kit { flex: 0 0 auto; gap: 8px; }
.fa-lobby .lobby-kit-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
/* The count is DATA, so it is quieter than the label and never quieter than AA:
   0.66 ink on the cream panel measures ~6:1, against a 4.5 floor. */
.fa-lobby .lobby-kit-owned {
  font-family: 'Heebo', sans-serif;
  font-size: var(--ds-t2);
  font-weight: var(--ds-w-body);
  color: rgba(26,18,36,0.66);
  white-space: nowrap;
}

/* TWO COLUMNS AT EVERY WIDTH, because ITEM_SLOTS is two and a slot that wrapped to its
   own row would read as a list rather than as a pair. 1fr each keeps them equal, so
   "empty" and "filled" are the same size and the pair reads as two of one thing. */
.fa-lobby .lobby-kit-slots {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

/* The slot. Sized from CSS, never from its label — the same drift note the seat-count
   control carries: text-driven widths move ~+-2 CSS px between runs on one tree, and
   'menu_accept_portrait''s MIN_TAP - 0.5 slack is inside that. */
.fa-lobby .lobby-slot {
  appearance: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: clamp(var(--tap), 7vh, 60px);
  min-width: 0;
  padding: 4px 10px;
  border: var(--ds-stroke-2) solid var(--ink);
  border-radius: var(--ds-r-2);
  box-shadow: var(--ds-e1);
  text-align: left;
  color: var(--ink);
  --fa-ic-ink: var(--ink);
}
/* '--ds-lip' is the elevation ladder's colour, per component — 'theme.ts' factored it out
   so a component picks a lip and keeps the six-rung shadow scale. Mustard takes the gold
   lip; the empty slot takes the root default. */
.fa-lobby .lobby-slot.is-filled {
  background: linear-gradient(180deg, var(--mustard-hi) 0%, var(--mustard) 100%);
  --ds-lip: var(--gold-shadow);
}
/* Empty is a DASHED ink outline on the cream panel, not a faint tint. The dash is the
   whole tell that this is a place something goes; the ink keeps the boundary at ~18:1
   instead of the 1.1:1 a 6%-alpha fill would have given it. */
.fa-lobby .lobby-slot.is-empty {
  background: var(--ds-paper-hi);
  border-style: dashed;
  justify-content: center;
}
.fa-lobby .lobby-slot:active { transform: translateY(2px); box-shadow: var(--ds-e0); }

/* A typographic '+', not an icon: the registry has no plus glyph, and 'ui.ts' is another
   pass's file. A '+' is a font character, so it is ours in a way an emoji is not — the
   defect the whole icon set exists to fix. */
.fa-lobby .lobby-slot-plus {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: var(--ds-r-round);
  background: var(--ink);
  color: var(--cream);
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-black);
  font-size: 15px;
  line-height: 1;
}
.fa-lobby .lobby-slot-ic { flex: 0 0 auto; font-size: 28px; line-height: 1; }
.fa-lobby .lobby-slot-txt {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.fa-lobby .lobby-slot.is-empty .lobby-slot-txt { flex: 0 1 auto; }
.fa-lobby .lobby-slot-name {
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-black);
  font-size: var(--ds-t3);
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* The shared badge, at the smallest size it is measured at. Height comes down; the
   1.6px stroke and 'paint-order' in 'theme.ts' do NOT, because that pair is what makes
   it 16.5:1 on all six fills instead of 3.69:1 on Epic. */
.fa-lobby .lobby-slot-rar {
  height: 17px;
  padding: 0 7px;
  font-size: 0.66rem;
  align-self: flex-start;
}
/* An equipped item the selected seat count cannot use. Ketchup-INK, which 'theme.ts'
   dropped in value for exactly this job: the fill red measures 4.17-2.56 as type on
   these surfaces and this one measures 5.9 on cream. */
.fa-lobby .lobby-slot.is-dead { box-shadow: var(--ds-e1), inset 4px 0 0 var(--ketchup-ink); }

.fa-lobby .lobby-kit-note {
  margin: 0;
  font-family: 'Heebo', sans-serif;
  font-size: var(--ds-t2);
  line-height: 1.3;
  color: rgba(26,18,36,0.78);
}
.fa-lobby .lobby-kit-note[hidden] { display: none; }

/* ── The picker ──────────────────────────────────────────────────────────────
   Absolutely positioned inside the screen root and inset by the safe area, so a notch
   cannot eat the close control. 'theme.ts' declares '--fa-safe-*' from 'env()';
   'menu_accept' overrides them on <html> to simulate a notched device, which is the only
   way any of this is testable on a machine with no notched hardware ('APP.md' 5). */
.fa-lobby .lobby-sheet {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  padding:
    calc(var(--fa-safe-t) + var(--gap))
    calc(var(--fa-safe-r) + var(--gutter))
    calc(var(--fa-safe-b) + var(--gap))
    calc(var(--fa-safe-l) + var(--gutter));
}
.fa-lobby .lobby-sheet[hidden] { display: none; }
/* 0.72 ink over the warm backdrop: dark enough that the cream card is unambiguously in
   front, light enough that the lobby is still visibly behind it rather than replaced. */
.fa-lobby .lobby-sheet-scrim {
  position: absolute;
  inset: 0;
  background: rgba(26,18,36,0.72);
}
.fa-lobby .lobby-sheet-card {
  position: relative;
  width: min(100%, 560px);
  max-height: 100%;
  box-shadow: var(--ds-e5);
}
.fa-lobby .lobby-sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex: 0 0 auto;
}
.fa-lobby .lobby-sheet-title { flex: 1 1 auto; min-width: 0; }
.fa-lobby .lobby-sheet-x { flex: 0 0 auto; }
.fa-lobby .lobby-sheet-sub {
  margin: 0;
  flex: 0 0 auto;
  font-family: 'Heebo', sans-serif;
  font-size: var(--ds-t2);
  line-height: 1.3;
  color: rgba(26,18,36,0.78);
}
.fa-lobby .lobby-sheet-list {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 2px;
}

/* ── An item row ─────────────────────────────────────────────────────────────
   A FULL INK BORDER, not a tinted tile. '.lobby-seat' above uses
   'rgba(26,18,36,0.06)' and gets away with it because it is not a control; these are
   buttons, and SC 1.4.11 asks for 3:1 on a control's own boundary. 0.06 ink on cream is
   ~1.1:1 — within rounding of the 1.026:1 the pause chip shipped at. */
.fa-lobby .lobby-item {
  appearance: none;
  cursor: pointer;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  min-height: var(--tap);
  padding: 8px 10px;
  text-align: left;
  background: var(--ds-paper-hi);
  border: var(--ds-stroke-1) solid var(--ink);
  border-radius: var(--ds-r-2);
  color: var(--ink);
  --fa-ic-ink: var(--ink);
}
.fa-lobby .lobby-item:active { transform: translateY(2px); }
/* Equipped. The product's "this is the live one" mustard, the same statement
   '.lobby-opt.is-on' makes, so the two selected states on this screen agree. */
.fa-lobby .lobby-item.is-on {
  background: linear-gradient(180deg, var(--mustard-hi) 0%, var(--mustard) 100%);
}
/* Not owned. THREE tells, because one is a colour and a colour alone is not a state:
   a dashed border, a lock glyph, and the words. 0.72 composites the whole row to ~7:1
   against the panel, so the blurb — which is the informed-choice content this screen
   exists to deliver — stays legible on a row you cannot press. */
.fa-lobby .lobby-item.is-locked {
  cursor: default;
  opacity: 0.72;
  border-style: dashed;
  background: var(--ds-paper);
}
.fa-lobby .lobby-item.is-locked:active { transform: none; }

.fa-lobby .lobby-item-ic { flex: 0 0 auto; font-size: 30px; line-height: 1; margin-top: 1px; }
.fa-lobby .lobby-item-body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.fa-lobby .lobby-item-top {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.fa-lobby .lobby-item-name {
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-black);
  font-size: var(--ds-t3);
  line-height: 1.1;
}
.fa-lobby .lobby-item-rar { height: 18px; padding: 0 7px; font-size: 0.68rem; }
/* WHAT IT DOES. 'ITEMS[id].blurb' verbatim — the registry's own player-facing line, so
   this screen cannot describe an item differently from anything else that shows one. */
.fa-lobby .lobby-item-blurb {
  font-family: 'Heebo', sans-serif;
  font-size: var(--ds-t2);
  line-height: 1.3;
  color: rgba(26,18,36,0.82);
}
.fa-lobby .lobby-item-meta {
  font-family: 'Heebo', sans-serif;
  font-size: var(--ds-t1);
  line-height: 1.25;
  color: rgba(26,18,36,0.66);
}
.fa-lobby .lobby-item-state {
  flex: 0 0 auto;
  align-self: center;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 34%;
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-bold);
  font-size: var(--ds-t1);
  line-height: 1.15;
  letter-spacing: var(--ds-track);
  text-transform: uppercase;
  text-align: right;
  color: rgba(26,18,36,0.78);
}
.fa-lobby .lobby-item.is-on .lobby-item-state { color: var(--ink); }
.fa-lobby .lobby-item-clear { width: 100%; }

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

/* ── THE LANDSCAPE PHONE, AND THIS BLOCK IS LAST ON PURPOSE ──────────────────
   ⚠️ A MEDIA QUERY ADDS NO SPECIFICITY. 'theme.ts' records what that cost: an identical
   selector written earlier in a file loses to one inside a later block, and a
   '@media (max-height: 460px)' rule placed above a '(max-height: 560px)' one delivered
   2.44px rows. This block re-declares '.lobby-kit' selectors that appear above it, so it
   must stay at the FOOT of this stylesheet.

   844x390 is 'DECISIONS §14''s shape and it is the tight one: ~240px of body band under
   the header and above the footer, which the seat panel alone can fill at six seats.
   The saving here is the kit's own stacking — label above count on the left, both slots
   on the right, note across the bottom — which is ~24px against putting the head on its
   own row, on the one viewport that has no rows to spare. */
@media (max-height: 460px) {
  .fa-lobby .lobby-kit {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    column-gap: 12px;
    row-gap: 6px;
    padding: 8px 10px;
  }
  .fa-lobby .lobby-kit-head { flex-direction: column; align-items: flex-start; gap: 1px; }
  .fa-lobby .lobby-kit-note { grid-column: 1 / -1; }
  /* The slot stays over the 44px floor — clamped from the SHORT axis, which is the one
     that runs out here — and its icon comes down so the name keeps its line. */
  .fa-lobby .lobby-slot { min-height: var(--tap); }
  .fa-lobby .lobby-slot-ic { font-size: 24px; }
  /* The picker is the whole viewport at this height: a centred card with 390px of room
     would be a 200px scroller. Stretched, it holds four rows instead of two. */
  .fa-lobby .lobby-sheet-card { width: 100%; max-width: 720px; }
}
`;
