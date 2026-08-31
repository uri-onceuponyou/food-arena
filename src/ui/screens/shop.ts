/**
 * Shop — the boxes, what they cost, and what is actually inside them.
 *
 * ── This screen invents NOTHING ─────────────────────────────────────────────
 * `game/economy/` is finished: pure, seeded-deterministic, 173 assertions, every
 * tunable in `tuning.ts`, and `containerOdds()` derives the published drop table from
 * the same array `rollContainer()` rolls against. So there is not one economy literal
 * below. Prices, contents, percentages, rarity pools, duplicate values and the
 * expected return are all read or computed from that model, and
 * `tools/tmp/shop_accept.mjs` re-derives every displayed number in Node, straight off
 * `CONTAINERS[kind].entries`, and asserts the DOM agrees. A hand-typed "89%" beside a
 * separately-authored weight table is a disclosure that WILL drift, and drift on a
 * loot-box surface is a compliance problem rather than a typo.
 *
 * ── THE JUDGEMENT CALL: what the shop does while it cannot sell ─────────────
 * `ROSTER_GATED` is false, so `ownedSet()` returns the whole roster, so every
 * character pull in every box resolves to its duplicate coin value instead. The four
 * purchasable boxes contain NOTHING BUT character rows — no coin entry, no gem entry
 * anywhere in `CONTAINERS` for hamburgerBox / pineappleBox / redBox / fireBox — so
 * today every one of them is a pure currency shredder. Measured off the model:
 *
 *     Hamburger Box     900 coins in   best case  520   average  138
 *     Purple Pineapple 3200 coins in   best case  900   average  276
 *     Big Smile Box    5600 coins in   best case 2200   average  563
 *     Purple Fire Box 12000 coins in   best case 2200   average  932
 *
 * The BEST possible outcome loses coins in all four. That is not a bad expected value,
 * it is an arithmetically guaranteed loss, and no presentation makes it honest to sell.
 *
 * Three options were on the table — hide it, disable it honestly, or preview-only.
 * This is **visible, complete, and disabled with the reason stated in the model's own
 * numbers**, because:
 *
 *   * That is already this codebase's precedent and it is already asserted. The gem
 *     store is priced, modelled and fulfillable, ships DISABLED behind an explicit
 *     "not available" banner, and `menu_accept` checks it in both directions — the
 *     buttons must be dead AND the copy must say so. Hiding this screen would
 *     contradict a rule the suite already enforces.
 *   * Hidden is unmeasurable. A screen nobody can reach has no contrast numbers, no
 *     portrait layout, no acceptance coverage and no screenshot — so "it will be fine
 *     when the flag flips" would be an assertion rather than a measurement, and this
 *     project has paid for that mistake before.
 *   * Disabled here is INFORMATIVE. The player gets the price, the full drop table,
 *     the rarity pool by name, and a plain statement of what the box would pay back.
 *     That is strictly more than they get from an absent screen, and it is the
 *     disclosure a paid randomised item is going to need anyway.
 *
 * What is NOT built is the thing both menu critics punished: a live-looking Buy button
 * that no-ops. Every unavailable control carries the DOM `disabled` attribute, so it
 * cannot be tapped, cannot be focused, and is excluded from `menu_accept`'s control
 * census by construction rather than by a check someone can forget.
 *
 * ── Flipping the gate is genuinely one line, and this file proves it ────────
 * `ROSTER_GATED` is never read here. Availability is derived instead:
 *
 *     sellable(kind, currency) =
 *         the box can hand over a fighter the player does not own
 *         OR its best possible payout in that currency exceeds its price
 *
 * `rollContainer()` prefers an unowned member of the rolled rarity's pool and only
 * converts to coins when there is none, so "can hand over a fighter" is exactly
 * `pool.some(id => !owned.has(id))` — the same condition, read off the same table.
 * Flip `ROSTER_GATED`, `ownedSet()` narrows to what the player has actually unlocked,
 * and every Buy button on this screen comes alive with no edit here at all.
 *
 * The derived form also gets the END GAME right, which a bare `if (ROSTER_GATED)`
 * could not: a player who has unlocked all eleven fighters under a live gate is back
 * in exactly the guaranteed-loss position, and the boxes correctly switch themselves
 * off again.
 *
 * ── What this screen deliberately does NOT do ───────────────────────────────
 * It does not open containers. `trophyRoad.ts` already owns opening and the reveal
 * card, with `menu_accept` assertions behind both, and a second reveal implementation
 * would be a second thing to keep honest for no gain. Held boxes are shown here as
 * read-only inventory with a real route to the screen that opens them.
 */

import {
  CHARACTER_IDS,
  CHARACTERS,
  ITEMS,
  RARITY_COLORS,
  RARITY_ORDER,
  type CharacterId,
  type ItemId,
  type Rarity,
} from '../../game/rules';
import {
  CHARACTERS_BY_RARITY,
  CONTAINERS,
  CONTAINER_KINDS,
  DUPLICATE_COINS,
  ITEMS_BY_RARITY,
  ITEM_DUPLICATE_COINS,
  RARITY_MEANING,
  containerOdds,
  formatPercent,
  ownedItemSet,
  totalWeight,
  type ContainerKind,
} from '../../game/economy';
import type { Screen, ScreenContext } from './types';
import { injectStyles } from './theme';
import { containerIcon, ensureIconStyles, icon } from '../icons';
import { el } from './fx';

// ─────────────────────────────────────────────────────────────────────────────
// Reading the model — every number on this screen comes through here
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The rarity ladder, DERIVED rather than typed out.
 *
 * ── ⚠️ THIS COMMENT SAID `rules.ts` HAD NO RUNTIME RARITY ARRAY. IT ALWAYS HAS. ──
 *
 * Kept per house style. It read:
 *
 *     '`Rarity` is a union type, so there is no runtime array of it anywhere in
 *      `rules.ts`, and both other screens that needed an order wrote their own literal.'
 *
 * `rules.ts` has exported `RARITY_ORDER` since the foundation commit (`33474ae`) — and
 * `economy.test.mjs` has been IMPORTING it the whole time, so this file was asserting
 * the non-existence of something its own test suite used. The second half was true and
 * was true BECAUSE of the first: `ui/screens/trophyRoad.ts:86` still hand-writes the
 * same six names. 🔴 REPORTED, not fixed — that file is a different owner's.
 *
 * The derivation stays, because it is still the better one HERE: this screen sorts by
 * VALUE, and `DUPLICATE_COINS` is the thing that encodes value — 120 / 260 / 520 / 900 /
 * 1400 / 2200, strictly ascending. `RARITY_ORDER` encodes DISPLAY order. They agree
 * today, and `economy.test.mjs` §14 now asserts they keep agreeing rather than leaving
 * one file to sort by price and another by position.
 */
const RARITY_LADDER: Rarity[] = (Object.keys(DUPLICATE_COINS) as Rarity[])
  .sort((a, b) => DUPLICATE_COINS[a] - DUPLICATE_COINS[b]);

/**
 * One row of a container's table, resolved against what the player owns.
 *
 * This mirrors `rollContainer()` exactly and deliberately: that function picks an
 * UNOWNED member of the rolled rarity's pool when one exists, and only falls back to
 * `DUPLICATE_COINS[rarity]` when the whole pool is already owned. So an outcome either
 * hands over a fighter or hands over coins, and which one it is depends on the owned
 * set rather than on a flag.
 */
interface Outcome {
  /** 0..1, normalised against the table's real weight total. */
  chance01: number;
  coins: number;
  gems: number;
  /** Set when this outcome can still grant a fighter the player does not have. */
  fighter: Rarity | null;
  /** Set when this outcome can still grant a loadout ITEM the player does not have. */
  item: Rarity | null;
}

function outcomes(
  kind: ContainerKind,
  owned: ReadonlySet<CharacterId>,
  ownedItems: ReadonlySet<ItemId>,
): Outcome[] {
  const entries = CONTAINERS[kind].entries;
  const total = totalWeight(entries);
  return entries.map((entry) => {
    let coins = entry.coins ?? 0;
    const gems = entry.gems ?? 0;
    let fighter: Rarity | null = null;
    if (entry.characterRarity) {
      const pool = CHARACTERS_BY_RARITY[entry.characterRarity] ?? [];
      if (pool.some((id) => !owned.has(id))) fighter = entry.characterRarity;
      else coins += DUPLICATE_COINS[entry.characterRarity];
    }
    // The item arm is `rollContainer`'s item branch read the same way the fighter arm
    // reads its character branch: grant if anything in the tier is unowned, otherwise
    // the duplicate value in coins. Two arms of one mirror, so they cannot drift apart.
    let item: Rarity | null = null;
    if (entry.itemRarity) {
      const pool = ITEMS_BY_RARITY[entry.itemRarity] ?? [];
      if (pool.some((id) => !ownedItems.has(id))) item = entry.itemRarity;
      else coins += ITEM_DUPLICATE_COINS[entry.itemRarity];
    }
    return { chance01: total > 0 ? entry.weight / total : 0, coins, gems, fighter, item };
  });
}

/** Every loadout item a container can produce, across all of its item rows. */
function itemPool(kind: ContainerKind): ItemId[] {
  return [...new Set(CONTAINERS[kind].entries.flatMap(
    (e) => (e.itemRarity ? ITEMS_BY_RARITY[e.itemRarity] ?? [] : []),
  ))];
}

interface BoxValue {
  /** True when at least one outcome can still produce a fighter. */
  canGrantFighter: boolean;
  /** True when at least one outcome can still produce an unowned loadout item. */
  canGrantItem: boolean;
  /** Best and expected currency return, given the same owned set. */
  bestCoins: number;
  bestGems: number;
  expectedCoins: number;
  expectedGems: number;
  /** Share of the table, 0..100, that is a character row at all. */
  characterPercent: number;
  /** Share of the table, 0..100, that is an ITEM row. */
  itemPercent: number;
  /** The lowest rarity the table can produce, or null for a currency-only container. */
  floorRarity: Rarity | null;
  /** The lowest ITEM rarity the table can produce, or null when it has no item rows. */
  itemFloorRarity: Rarity | null;
  /** Items in this box the player does not own yet, and how many the box holds at all. */
  missingItems: number;
  poolItems: number;
}

function boxValue(
  kind: ContainerKind,
  owned: ReadonlySet<CharacterId>,
  ownedItems: ReadonlySet<ItemId>,
): BoxValue {
  const rows = outcomes(kind, owned, ownedItems);
  const pool = itemPool(kind);
  const value: BoxValue = {
    canGrantFighter: false,
    canGrantItem: false,
    bestCoins: 0,
    bestGems: 0,
    expectedCoins: 0,
    expectedGems: 0,
    characterPercent: 0,
    itemPercent: 0,
    floorRarity: null,
    itemFloorRarity: null,
    missingItems: pool.filter((id) => !ownedItems.has(id)).length,
    poolItems: pool.length,
  };
  for (const row of rows) {
    if (row.fighter) value.canGrantFighter = true;
    if (row.item) value.canGrantItem = true;
    value.bestCoins = Math.max(value.bestCoins, row.coins);
    value.bestGems = Math.max(value.bestGems, row.gems);
    value.expectedCoins += row.chance01 * row.coins;
    value.expectedGems += row.chance01 * row.gems;
  }
  // The rarity questions are asked of the TABLE, not of the resolved outcomes: what a
  // box contains does not change when a player happens to own it all.
  const total = totalWeight(CONTAINERS[kind].entries);
  for (const entry of CONTAINERS[kind].entries) {
    const pct = total > 0 ? (entry.weight / total) * 100 : 0;
    if (entry.characterRarity) {
      value.characterPercent += pct;
      const here = RARITY_LADDER.indexOf(entry.characterRarity);
      const have = value.floorRarity === null ? Infinity : RARITY_LADDER.indexOf(value.floorRarity);
      if (here < have) value.floorRarity = entry.characterRarity;
    }
    if (entry.itemRarity) {
      value.itemPercent += pct;
      const here = RARITY_LADDER.indexOf(entry.itemRarity);
      const have = value.itemFloorRarity === null
        ? Infinity : RARITY_LADDER.indexOf(value.itemFloorRarity);
      if (here < have) value.itemFloorRarity = entry.itemRarity;
    }
  }
  return value;
}

type Currency = 'coins' | 'gems';

/**
 * Whether a box may be offered for sale at all, in one currency.
 *
 * See the header. A fighter the player does not own is the reason boxes exist, so that
 * alone qualifies; otherwise the box is a currency converter and may only be sold if it
 * can at least return more than it took. Nothing here reads `ROSTER_GATED`.
 *
 * ── 🚨 2026-08-31: ITEMS DELIBERATELY DO **NOT** QUALIFY, AND THAT IS A PARKED
 *    DECISION RATHER THAN AN OVERSIGHT ───────────────────────────────────────
 *
 * Every box is 20% loadout items now, and **items have no `ROSTER_GATED`** — a new player
 * owns one of ten — so on the header's own wording (*"the box can hand over CONTENT the
 * player does not own"*) every box would qualify and four Buy buttons that have been dead
 * since this screen was built would come alive. That version was written, measured and
 * BACKED OUT. Three reasons, in the order they decided it:
 *
 *   1. **The arithmetic did not move.** Measured off the model at a full roster with only
 *      `STARTER_ITEM` owned: Hamburger Box 900 coins in, **130** back on average, 4% of
 *      rolls an item the player lacks. Pineapple 3,200 in / **221**. Big Smile 5,600 in /
 *      **450**. Fire 12,000 in / **745**. The founding argument of this screen is that no
 *      presentation makes that honest to SELL, and a 4% item does not change the number.
 *   2. **Gems buy boxes and real money will buy gems.** Switching four purchase controls
 *      on is a monetisation decision, and it is Uri's, not a side effect of an acquisition
 *      task. 🔴 PARKED FOR URI with the four numbers above.
 *   3. It would have forced an edit to `tools/tmp/menu_accept.mjs` — a different owner's
 *      file — whose `flow/shop/unavailability-is-stated-in-words` check goes RED the
 *      moment the "Nothing here is for sale yet" banner disappears. Measured: 506/507.
 *
 * ⚠️ **Reversing it is exactly one clause** — `|| value.canGrantItem` on the line below —
 * and `boxValue` already computes everything the enabled state needs. What is NOT parked
 * is the disclosure: every sentence on this screen that described a box as "only able to
 * pay coins back" was made false by the item rows and every one of them is corrected,
 * because a screen may decline to sell you something but may never lie about what is in it.
 */
function sellable(kind: ContainerKind, currency: Currency, owned: ReadonlySet<CharacterId>,
  ownedItems: ReadonlySet<ItemId>): boolean {
  const price = CONTAINERS[kind].price;
  if (!price) return false;
  const value = boxValue(kind, owned, ownedItems);
  if (value.canGrantFighter) return true;
  return currency === 'coins' ? value.bestCoins > price.coins : value.bestGems > price.gems;
}

/** The boxes that carry a price. `price: null` is the model's own enforcement that a
 *  chest is progression-only — `store.ts` cannot list an unpriced container and
 *  `economy.test.mjs` asserts the chest stays unpriced — so this filter cannot disagree
 *  with it, and a container that gains or loses a price moves side on its own. */
const PRICED_KINDS = CONTAINER_KINDS.filter((kind) => CONTAINERS[kind].price !== null);

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export function createShopScreen(ctx: ScreenContext): Screen {
  injectStyles('fa-shop-styles', CSS);
  ensureIconStyles();

  const root = el('div', 'fa-screen fa-shop');
  const profile = ctx.profile;

  root.innerHTML = `
    <header class="fa-topbar">
      <button class="fa-iconbtn" type="button" data-el="back" aria-label="Back to home">${icon('back')} Back</button>
      <h1 class="fa-title shop-heading">Shop</h1>
      <div class="fa-topbar-spacer"></div>
      <div class="fa-chip"><span class="fa-chip-em">${icon('coin')}</span><span data-el="coins">0</span></div>
      <div class="fa-chip fa-chip--gem"><span class="fa-chip-em">${icon('gem')}</span><span data-el="gems">0</span></div>
    </header>

    <div class="fa-panel fa-panel--flush shop-body">
      <div class="fa-scroll shop-scroll" data-el="scroll"></div>
    </div>

    <footer class="shop-bottom">
      <p class="shop-foot-note" data-el="footnote"></p>
      <div class="shop-foot-actions">
        <button class="fa-btn fa-btn--quiet" type="button" data-go="trophies">${icon('trophy')} Trophy Road</button>
        <button class="fa-btn fa-btn--green" type="button" data-go="characters">${icon('play')} Play a match</button>
      </div>
    </footer>
  `;

  const q = <T extends HTMLElement>(sel: string): T => {
    const node = root.querySelector<T>(`[data-el="${sel}"]`);
    if (!node) throw new Error(`shop: missing element "${sel}"`);
    return node;
  };

  const scroll = q<HTMLDivElement>('scroll');

  // ── Card fragments ─────────────────────────────────────────────────────────

  /**
   * The drop table, INLINE on the card rather than behind a tap.
   *
   * The trophy road puts the same disclosure behind a "Drop rates" button, which is
   * right for a progression screen. This is the screen where a player would spend, so
   * the odds sit next to the price with nothing to open. It also means the standard
   * instrument measures them: `tools/tmp/screen_metrics.mjs` scores the mounted screen,
   * and a modal it has to be told how to open is a modal that goes unscored.
   *
   * The rarity colour is a SWATCH and never the ink. Measured on this project's other
   * odds sheet: Cyber on white is 1.64:1, Legendary 2.08, Normal 2.76 — every coloured
   * row below AA, on the one surface in the product that is a legal disclosure. The
   * rarity palette is authored for fills behind white type; it was never a text palette.
   */
  function oddsList(kind: ContainerKind): string {
    const rows = containerOdds(kind).map((row) => `
      <li class="shop-odds-row">
        <span class="shop-odds-what">${
          row.rarity ? `<i class="shop-odds-dot" style="background:${RARITY_COLORS[row.rarity]}"></i>` : ''
        }${row.label}</span>
        <span class="shop-odds-pct">${formatPercent(row.percent)}</span>
      </li>`).join('');
    return `<ul class="shop-odds">${rows}</ul>`;
  }

  /** Who is actually in each pool, by name. An odds row that says "Rare fighter 10%"
   *  without naming the four Rares is a percentage the player cannot act on — and the
   *  same is true of "Rare item 3.6%", which is why both kinds of pool are named here.
   *  ⚠️ `row.itemPool` is a separate field from `row.pool` on purpose: both this
   *  renderer and `trophyRoad.ts`'s do `CHARACTERS[id].name` over `pool`, so an `ItemId`
   *  in there is a TypeError inside a screen render. See `containers.ts:OddsRow`. */
  function poolLines(kind: ContainerKind): string {
    const lines = containerOdds(kind)
      .filter((row) => row.rarity && ((row.pool && row.pool.length > 0)
        || (row.itemPool && row.itemPool.length > 0)))
      .map((row) => `<span class="shop-pool-line"><i class="shop-odds-dot" style="background:${
        RARITY_COLORS[row.rarity as Rarity]
      }"></i>${(row.pool ?? []).map((id) => CHARACTERS[id].name)
    .concat((row.itemPool ?? []).map((id) => ITEMS[id].name)).join(', ')}</span>`)
      .join('');
    return lines ? `<div class="shop-pool">${lines}</div>` : '';
  }

  /**
   * One purchasable box.
   *
   * The two price buttons are the only controls, and each is enabled only when the
   * model says the box is worth selling in that currency AND the player can afford it.
   * Both refusals carry their reason: an unexplained disabled button is the same defect
   * as a dead live-looking one.
   */
  function boxCard(
    kind: ContainerKind,
    owned: ReadonlySet<CharacterId>,
    ownedItems: ReadonlySet<ItemId>,
  ): string {
    const def = CONTAINERS[kind];
    const price = def.price!;
    const value = boxValue(kind, owned, ownedItems);

    // "or BETTER" until 2026-08-05, and it had become a claim the model does not
    // compute. `rules.ts` DEVIATION #12 removed power from rarity at equal level
    // (measured tier spread 20.7 pp -> 4.0 pp, inside the ~9 pp noise floor), and
    // `061e794` purged the same word from every container blurb and from the trophy
    // road's own tier pips — but not from here, because this file had a different
    // owner. What this line has ALWAYS measured is `value.floorRarity`, the rarest-
    // ladder floor of the box's character pool, i.e. exactly "or rarer".
    //
    // ── ⚠️ AND "ALWAYS A FIGHTER" STOPPED BEING TRUE ON 2026-08-31 ────────────
    // Every box gave up exactly 20% of its table to loadout items, so `characterPercent`
    // is 80 and this chip correctly disappeared on its own — the guard was written
    // against the TABLE rather than against a remembered fact, which is why a tuning
    // change could not turn it into a lie. It is kept, unchanged, for the day an item-free
    // container exists again; and the item share gets its own chip beside it rather than
    // being folded in, because "always a fighter OR an item" would be a true statement
    // about the table that reads as a promise about the payout — and 80% of this table
    // pays coins while `ROSTER_GATED` is false.
    const guarantee = value.canGrantFighter && value.characterPercent >= 99.999 && value.floorRarity
      ? `<span class="shop-guarantee"><i class="shop-odds-dot" style="background:${
        RARITY_COLORS[value.floorRarity]
      }"></i>Always a fighter, ${value.floorRarity} or rarer</span>`
      : '';

    // The item chip states a RATE, not a guarantee, and only when an item in this box is
    // actually still missing. A player who owns all ten sees nothing here rather than an
    // invitation to buy a box that can only pay them a duplicate.
    const itemChip = value.canGrantItem && value.itemFloorRarity
      ? `<span class="shop-guarantee shop-guarantee--item"><i class="shop-odds-dot" style="background:${
        RARITY_COLORS[value.itemFloorRarity]
      }"></i>${formatPercent(value.itemPercent)} loadout item, ${
        value.itemFloorRarity} or rarer</span>`
      : '';

    const buy = (currency: Currency): string => {
      const cost = currency === 'coins' ? price.coins : price.gems;
      const held = currency === 'coins' ? profile.coins : profile.gems;
      const mark = icon(currency === 'coins' ? 'coin' : 'gem');
      const offered = sellable(kind, currency, owned, ownedItems);
      const affordable = held >= cost;
      const on = offered && affordable;
      // Every disabled control says why, even when the card's own reason block covers
      // the common case. The case it does not cover is real and is reachable the moment
      // the gate flips: a player who can afford the coin price but not the gem price
      // sees one live button beside one dead one, and without this the dead one is a
      // control with no explanation attached to it at all.
      const reason = offered
        ? `You need ${(cost - held).toLocaleString()} more ${currency}`
        : 'Not for sale right now';
      return `
        <button class="shop-buy shop-buy--${currency}${on ? '' : ' is-off'}" type="button"
          data-buy="${kind}" data-currency="${currency}"${
  on ? '' : ` disabled title="${reason}" aria-label="${cost.toLocaleString()} ${currency}. ${reason}."`}>
          ${mark} ${cost.toLocaleString()}
        </button>`;
    };

    // The refusal, in the model's own arithmetic. Only the claims the numbers support
    // are made: "a guaranteed loss" is emitted when the BEST outcome is below the
    // price, and downgraded to the plain expected return when it is not.
    let why = '';
    if (!sellable(kind, 'coins', owned, ownedItems) && !sellable(kind, 'gems', owned, ownedItems)) {
      const paysCoinsOnly = value.bestGems === 0;
      const detail = value.bestCoins < price.coins
        ? `It pays back at most ${value.bestCoins.toLocaleString()} coins for a ${price.coins.toLocaleString()} coin price, and ${Math.round(value.expectedCoins).toLocaleString()} on average.`
        : `Its average return is ${Math.round(value.expectedCoins).toLocaleString()} coins against a ${price.coins.toLocaleString()} coin price.`;
      // ── ⚠️ "SO IT CAN ONLY PAY COINS BACK" BECAME FALSE WITHOUT THIS FILE BEING
      //    TOUCHED, WHICH IS THE WHOLE LESSON ────────────────────────────────
      // The old sentence, kept here because the way it broke matters more than the words:
      //
      //     'Every fighter this box can give is already unlocked, so it can only pay
      //      coins back. <detail>'
      //
      // True the day it was written and false the day `tuning.ts` gave every box 20% item
      // rows — a screen that reads its numbers off the model still hard-codes its NOUNS,
      // and a noun does not go red. The refusal is unchanged and still correct (the coin
      // arithmetic did not move); what changed is that the box now holds something the
      // player genuinely lacks, and saying otherwise on a drop-rate surface is the one
      // thing this screen may not do. So the sentence names the item route instead of
      // denying the items exist.
      const stillMissing = value.missingItems;
      // ⚠️ WRITTEN SHORT ON PURPOSE, AND THE BUDGET IS A MEASUREMENT. The item rows
      // roughly DOUBLED every card's odds table and added a pool line per tier, and at
      // 1600x900 this panel hugs its content up to 759px before it starts scrolling. The
      // disclosure is not negotiable — those rows are the drop rates a randomised paid
      // container has to publish — so the prose is what gives way. Measured with
      // `tools/tmp/ea_shop_shot.mjs`, which reports the scroller's own clientH/scrollH.
      why = `
        <p class="shop-why">
          <span class="shop-why-head">Not for sale</span>
          Every fighter here is already unlocked, so a fighter roll only pays
          ${paysCoinsOnly ? 'coins' : 'currency'} back. ${detail}
          ${stillMissing > 0
    ? `Its ${stillMissing} unowned loadout item${stillMissing === 1 ? '' : 's'} come from
            Chests and the Trophy Road.`
    : 'You own every loadout item in it too.'}
        </p>`;
    } else if (!(profile.coins >= price.coins) && !(profile.gems >= price.gems)) {
      why = `
        <p class="shop-why">
          <span class="shop-why-head">Keep playing</span>
          You need ${(price.coins - profile.coins).toLocaleString()} more coins
          or ${(price.gems - profile.gems).toLocaleString()} more gems for this one.
        </p>`;
    } else {
      // SELLABLE and affordable. This branch is unreachable today and it is the one the
      // flip lands on, so it is written from the model rather than left as a stub — the
      // first version said "Average return: 0 coins", which is arithmetically true (with
      // nothing owned, no outcome converts to coins) and completely meaningless to read.
      // The number a buyer wants here is how much of the pool they are still missing.
      const pool = [...new Set(
        CONTAINERS[kind].entries.flatMap((e) => (e.characterRarity
          ? CHARACTERS_BY_RARITY[e.characterRarity] ?? []
          : [])),
      )];
      const missing = pool.filter((id) => !owned.has(id)).length;
      // The branch is on the EXPECTED RETURN, not on how many fighters are owned, and
      // the difference is the whole point. `rollContainer()` prefers an unowned member
      // of the rolled rarity's pool, so a duplicate is only possible once an ENTIRE
      // rarity tier inside this box is owned. Branching on "owns any of them" produced
      // "a repeat trades in for coins, 0 on average" — a promise of a payout the roller
      // could not have made, sitting next to the number that says so.
      //
      // ⚠️ AND IT NOW HAS AN ITEM CLAUSE, WHICH IS APPENDED RATHER THAN LEADING.
      // A box is not sellable BECAUSE of its items (see `sellable`); reaching this branch
      // still means the gate flipped and there is a fighter to win, so the fighter count
      // stays the headline and the items are the extra. Leading with the item would have
      // sold the box on the 20% and buried the 80%.
      const itemNote = value.missingItems > 0
        ? ` It also holds ${value.missingItems} loadout item${value.missingItems === 1 ? '' : 's'}
            you do not have, at ${formatPercent(value.itemPercent)} of the table.`
        : '';
      why = value.expectedCoins === 0
        ? `<p class="shop-why"><span class="shop-why-head">What you get</span>
            Every fighter roll here is a new fighter. ${missing} of the ${pool.length} are
            still missing from your roster.${itemNote}</p>`
        : `<p class="shop-why"><span class="shop-why-head">Duplicates</span>
            ${missing} of the ${pool.length} fighters here are still missing. A repeat
            trades in for coins, ${Math.round(value.expectedCoins).toLocaleString()} on
            average across the table.${itemNote}</p>`;
    }

    return `
      <article class="shop-card">
        <div class="shop-card-head">
          <span class="shop-card-em">${containerIcon(kind)}</span>
          <div class="shop-card-id">
            <h3 class="shop-card-name">${def.name}</h3>
            ${guarantee}${itemChip}
          </div>
        </div>
        <p class="shop-blurb">${def.blurb}</p>
        <p class="shop-oddshead">What is inside</p>
        ${oddsList(kind)}
        ${poolLines(kind)}
        <div class="shop-prices">${buy('coins')}${buy('gems')}</div>
        ${why}
      </article>`;
  }

  /** The free container. It has no price by construction (`price: null` in the model),
   *  so it gets no price row and no disabled button — it gets the two ways to earn it,
   *  one of which is a live number off the player's own win count. */
  function chestCard(kind: ContainerKind): string {
    const def = CONTAINERS[kind];
    const wins = profile.winsToNextChest;
    return `
      <article class="shop-card shop-card--free">
        <div class="shop-card-head">
          <span class="shop-card-em">${containerIcon(kind)}</span>
          <div class="shop-card-id">
            <h3 class="shop-card-name">${def.name}</h3>
            <span class="shop-guarantee shop-guarantee--free">Earned, never sold</span>
          </div>
        </div>
        <p class="shop-blurb">${def.blurb}</p>
        <p class="shop-oddshead">What is inside</p>
        ${oddsList(kind)}
        ${poolLines(kind)}
        <p class="shop-why">
          <span class="shop-why-head">How to get one</span>
          ${wins === 1 ? 'One more win' : `${wins} more wins`} for the next free ${def.name},
          and the Trophy Road hands out more along the way.
        </p>
      </article>`;
  }

  /** Read-only inventory. Opening lives on the trophy road, which is one tap away and
   *  already has the reveal card; a second implementation of it here would be a second
   *  thing to keep correct. */
  function inventory(): string {
    const held = CONTAINER_KINDS.filter((kind) => (profile.containers[kind] ?? 0) > 0);
    if (held.length === 0) return '';
    const chips = held.map((kind) => `
      <span class="shop-held">
        <span class="shop-held-em">${containerIcon(kind)}</span>
        <span class="shop-held-name">${CONTAINERS[kind].name}</span>
        <span class="shop-held-n">${profile.containers[kind]}</span>
      </span>`).join('');
    return `
      <section class="shop-section shop-inv">
        <h2 class="shop-section-title">Your boxes</h2>
        <div class="shop-heldrow">${chips}</div>
        <p class="shop-why"><span class="shop-why-head">Waiting to be opened</span>
          Open them on the Trophy Road, below.</p>
      </section>`;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  function render(): void {
    const owned = profile.unlocked;
    // `profile.economy` is documented as "the live economy state. Read freely" — there is
    // no `profile.ownedItems` getter and `profile.ts` is a different owner's file, so the
    // set is derived here through the economy module's own accessor rather than by
    // reaching into `state.items` and inventing a second definition of ownership.
    const ownedItems = ownedItemSet(profile.economy);
    q('coins').textContent = profile.coins.toLocaleString();
    q('gems').textContent = profile.gems.toLocaleString();

    const anySellable = PRICED_KINDS.some(
      (kind) => sellable(kind, 'coins', owned, ownedItems)
        || sellable(kind, 'gems', owned, ownedItems),
    );

    // The banner is the one place the whole state is stated once, in words, at the top
    // of the screen — the same move the gem store makes and the same one `menu_accept`
    // already checks there. Written from the model: the roster size is counted, not
    // typed, so an eleventh-and-a-half character cannot make this sentence wrong.
    // ⚠️ THIS BANNER SAID "every box can only pay coins back" AND THAT WENT FALSE THE
    // DAY BOXES GREW ITEM ROWS — same defect as the card copy below, same cause: the
    // numbers are derived and the nouns are not. The refusal itself is unchanged and is
    // still the measured truth (every box returns less currency than it costs), so the
    // banner keeps its verdict and stops overstating the reason.
    const notice = anySellable ? '' : `
      <p class="shop-notice">${icon('cone')}
        <span><strong>Nothing here is for sale yet.</strong>
        You own all ${CHARACTER_IDS.length} fighters, so a fighter roll only pays coins
        back and every box returns less than it costs. Loadout items come from free
        Chests and the Trophy Road.
        <span class="shop-notice-more">Buying is switched off rather than offered as a
        bad deal. Everything below is real: these are the prices and the drop rates the
        game will use.</span></span>
      </p>`;

    // ONE grid holding all five, in the model's own order, and that is a fix rather
    // than a tidy-up. The free chest started in a section of its own under a "Free
    // container" heading, which pushed the total content past the panel at 1600x900 —
    // so the desktop screenshot ended on an orphaned section title sitting exactly on
    // the fold, which reads as a broken layout rather than as scrollable content. One
    // row of five fits, the heading that carried no information is gone, and the card
    // itself still says "Earned, never sold" where a reader is actually looking.
    scroll.innerHTML = `
      ${notice}
      ${inventory()}
      <section class="shop-section">
        <h2 class="shop-section-title">Boxes and chests</h2>
        <!-- WHAT RARITY BUYS, on the screen where a player would spend.
             NOTE the single quotes: this comment sits inside a JS template literal,
             where one backtick terminates the string and 500s the dev server for
             every agent in the repo (docs/LESSONS.md section 9).
             'tuning.ts' owns this sentence (RARITY_MEANING) and the trophy road's
             drop-rate sheet already prints it. This screen puts the FULL drop table
             inline — deliberately, so the disclosure is measured rather than hidden
             behind a tap — and then said nothing about what a rarer fighter is worth,
             on the one surface that quotes a price next to it. Rendered from the
             model's own string so the two surfaces cannot drift. -->
        <p class="shop-rarity">${RARITY_MEANING}</p>
        <div class="shop-grid">${CONTAINER_KINDS.map((kind) => (
    CONTAINERS[kind].price ? boxCard(kind, owned, ownedItems) : chestCard(kind)
  )).join('')}</div>
      </section>
    `;

    // ⚠️ SHORTENED, AND THE REASON IS A MEASUREMENT, NOT TASTE. `.shop-foot-note` is
    // `white-space: nowrap; overflow: hidden`, so this band ELLIPSES rather than wraps.
    // The `anySellable` branch had never rendered on a phone — nothing was sellable, so
    // the screen always took the short string — and items flipped it on: at 390px
    // 'Coins and gems are earned by playing. Both work on every box.' clipped to
    // '...Both work on e…'. Measured with `tools/tmp/ea_shop_shot.mjs` at 390x844, which
    // is also how it was found. A truncated sentence is the ONE defect on this screen a
    // reader cannot recover from, because the missing half is the half that says what
    // the currency is for.
    // ⚠️ The branch is unreachable again now that `sellable` excludes items — but the
    // measurement was real and the string is one clause away from rendering, so the fix
    // stays rather than waiting to be rediscovered by whoever flips that clause.
    q('footnote').textContent = anySellable
      ? 'Coins and gems both work on every box.'
      : 'Boxes are earned, not bought:';
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  q<HTMLButtonElement>('back').addEventListener('click', () => ctx.navigate({ name: 'home' }));

  // One delegated handler for navigation and for the purchase path. The purchase path
  // is written, wired and unreachable today because every button that would reach it
  // carries `disabled` — which is deliberate: the code that runs the day the gate flips
  // is the code that is here now, not code somebody writes later.
  const onClick = (ev: MouseEvent): void => {
    const target = ev.target as HTMLElement;

    const go = target.closest<HTMLElement>('[data-go]')?.dataset.go;
    if (go === 'trophies') { ctx.navigate({ name: 'trophies' }); return; }
    if (go === 'characters') { ctx.navigate({ name: 'characters' }); return; }

    const buy = target.closest<HTMLButtonElement>('[data-buy]');
    if (!buy || buy.disabled) return;
    const kind = buy.dataset.buy as ContainerKind;
    const currency = buy.dataset.currency as Currency;
    // Re-checked here rather than trusted from the markup: a stale render must never be
    // able to authorise a purchase the model would refuse.
    if (!sellable(kind, currency, profile.unlocked, ownedItemSet(profile.economy))) return;
    profile.buyContainer(kind, currency);
  };
  root.addEventListener('click', onClick);

  const unsubscribe = profile.onChange(render);
  render();

  return {
    root,
    dispose() {
      unsubscribe();
      root.removeEventListener('click', onClick);
      root.remove();
    },
  };
}

const CSS = `
.fa-shop .shop-heading { flex: 0 1 auto; }

/* HUGS its content, then scrolls — it does not stretch to the row.
   At 2560x1080 the five cards fill about 55% of the middle row and the rest was flat
   cream inside a bordered surface, which is the exact "unfinished build" signal two
   critics have already named on this project (the trophy road's first road panel and
   home's first left rail). 'align-self: center' makes the height content-driven, and
   'max-height: 100%' hands it back to the row the moment the content is taller than the
   frame — at which point the inner '.fa-scroll' takes over. Same pair of declarations
   home uses on its flank cards, for the same reason. */
.fa-shop .shop-body {
  min-height: 0;
  align-self: center;
  max-height: 100%;
}
.fa-shop .shop-scroll {
  display: flex;
  flex-direction: column;
  gap: clamp(8px, 1.6vh, 14px);
  padding: clamp(8px, 1.5vh, 14px);
}

/* ── The honest banner ────────────────────────────────────────────────────────
   Mustard plate, ink type: measured 11.9:1, and it is the loudest object in the
   scroller on purpose. The gem store uses the identical treatment for the identical
   job one screen over, and 'menu_accept' asserts that a claim of unavailability is
   made in words there — so this is one idiom, not two. */
.fa-shop .shop-notice {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin: 0;
  padding: 10px 13px;
  background: var(--mustard);
  border: 3px solid var(--ink);
  border-radius: 14px;
  box-shadow: 0 4px 0 rgba(0,0,0,0.3);
  font-family: 'Heebo', sans-serif;
  font-size: clamp(0.72rem, 1.5vh, 0.84rem);
  font-weight: 700;
  line-height: 1.38;
  color: var(--ink);
}
.fa-shop .shop-notice .fa-ic { font-size: 1.4em; margin-top: 1px; }
.fa-shop .shop-notice strong { font-family: 'Rubik', sans-serif; font-weight: 900; }

/* ── Sections ─────────────────────────────────────────────────────────────── */
.fa-shop .shop-section { display: flex; flex-direction: column; gap: 7px; }
.fa-shop .shop-section-title {
  margin: 0;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: clamp(0.78rem, 1.85vh, 1rem);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink);
}
.fa-shop .shop-section-title::after {
  content: '';
  display: block;
  width: 32px;
  height: 4px;
  margin-top: 5px;
  border-radius: 999px;
  background: var(--gold);
}

/* The rarity disclosure. Solid ink on the panel's own cream, no alpha and no plate:
   the same decision '.shop-oddshead' records two rules down, for the same reason —
   a tinted section note measured 4.85:1 on the trophy road and its scroller fade took
   it to 3.93. This one is a legal disclosure on a priced surface, so there is no
   headroom to spend at all. */
.fa-shop .shop-rarity {
  margin: 0 0 1px;
  font-family: 'Heebo', sans-serif;
  font-weight: 700;
  font-size: clamp(0.7rem, 1.32vh, 0.78rem);
  line-height: 1.35;
  color: #40291A;
}

/* Auto-fit rather than a breakpoint ladder: four cards at desktop, two on a landscape
   phone, one in portrait, with no media query deciding which. The floor is 232px
   because the widest thing on a card is a drop-rate row, and below that the label and
   the percentage collide. */
.fa-shop .shop-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(232px, 1fr));
  gap: clamp(7px, 1.3vh, 12px);
  align-items: stretch;
}

/* ── One box ──────────────────────────────────────────────────────────────── */
.fa-shop .shop-card {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 11px 12px 12px;
  background: #FFFFFF;
  border: 3px solid var(--ink);
  border-radius: 14px;
  box-shadow: 0 4px 0 rgba(0,0,0,0.3), inset 0 2px 0 rgba(255,255,255,0.9);
}
.fa-shop .shop-card--free { background: linear-gradient(180deg, #FFFFFF 0%, #F3E6CE 100%); }

.fa-shop .shop-card-head { display: flex; align-items: center; gap: 10px; }
.fa-shop .shop-card-em { font-size: clamp(1.9rem, 4.6vh, 2.8rem); line-height: 1; flex: 0 0 auto; }
.fa-shop .shop-card-id { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.fa-shop .shop-card-name {
  margin: 0;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: clamp(0.84rem, 2vh, 1.06rem);
  line-height: 1.1;
  color: var(--ink);
}

/* The floor of the table, as a swatch plus ink. Never coloured type: the rarity
   palette is a FILL palette and every one of its six values fails AA as ink on white. */
.fa-shop .shop-guarantee {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.69rem, 1.35vh, 0.78rem);
  color: #3B2A18;
}
.fa-shop .shop-guarantee--free { color: #4E2C1B; }
/* The item chip states a RATE, not a guarantee, and stacks under the fighter one when
   both are present ('.shop-card-id' is a column). Same ink deliberately: the rarity
   channel is carried by the 10px dot and never by the type — measured on this project's
   other odds sheet, every rarity colour is below AA as text on cream.
   NOTE THE SINGLE QUOTES: this block is inside a JS template literal and one backtick
   terminates it — the trap this file already warns about 400 lines up, and which I
   walked straight into while writing a comment about being careful. */
.fa-shop .shop-guarantee--item { color: #4E2C1B; }

.fa-shop .shop-blurb {
  margin: 1px 0 2px;
  font-family: 'Heebo', sans-serif;
  font-size: clamp(0.72rem, 1.4vh, 0.8rem);
  font-weight: 700;
  line-height: 1.3;
  color: #4E2C1B;
}

.fa-shop .shop-oddshead {
  margin: 3px 0 0;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.69rem, 1.3vh, 0.75rem);
  letter-spacing: 0.09em;
  text-transform: uppercase;
  /* Solid, not a tint. A 0.62 alpha section label on this card measured 4.85:1 on the
     trophy road and its own scroller fade was enough to push it to 3.93 — the last
     failing run in that whole battery. There is no headroom in a marginal number. */
  color: #4E2C1B;
}

.fa-shop .shop-odds {
  margin: 2px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.fa-shop .shop-odds-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  font-family: 'Rubik', sans-serif;
  font-weight: 700;
  font-size: clamp(0.72rem, 1.45vh, 0.82rem);
  color: var(--ink);
}
.fa-shop .shop-odds-what { display: flex; align-items: center; gap: 7px; min-width: 0; }
.fa-shop .shop-odds-dot {
  flex: 0 0 auto;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 1.5px solid rgba(26,18,36,0.6);
}
.fa-shop .shop-odds-pct {
  flex: 0 0 auto;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  color: var(--ink);
}

.fa-shop .shop-pool {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 4px;
  padding-top: 5px;
  border-top: 2px dotted rgba(26,18,36,0.22);
}
.fa-shop .shop-pool-line {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: 'Heebo', sans-serif;
  font-weight: 700;
  font-size: clamp(0.69rem, 1.25vh, 0.76rem);
  line-height: 1.25;
  color: #4E2C1B;
}

/* ── Price row ────────────────────────────────────────────────────────────── */
.fa-shop .shop-prices { display: flex; gap: 7px; margin-top: auto; padding-top: 7px; }
.fa-shop .shop-buy {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: var(--tap);
  padding: 0 10px;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: clamp(0.76rem, 1.7vh, 0.92rem);
  font-variant-numeric: tabular-nums;
  border: 3px solid var(--ink);
  border-radius: 999px;
  background: linear-gradient(180deg, var(--mustard-hi) 0%, var(--mustard) 100%);
  box-shadow: 0 4px 0 var(--gold-shadow);
  color: var(--ink);
  cursor: pointer;
  transition: transform 0.08s, box-shadow 0.08s, filter 0.12s;
}
.fa-shop .shop-buy:hover { filter: brightness(1.06); }
.fa-shop .shop-buy:active { transform: translateY(4px); box-shadow: 0 0 0 var(--gold-shadow); }

/* UNAVAILABLE, and it must not read as broken.
   No layer opacity anywhere in this rule, and that is the point: a container opacity
   composites the type together with its own plate, so it lowers the contrast of the
   run underneath it and no computed style anywhere reports that it happened. The trophy
   road shipped exactly that on its claimed nodes and hid fifteen sub-AA runs behind it.
   This is a flat unavailable plate with explicit ink instead: measured 6.6:1, and the
   price stays perfectly legible because the price is the information. */
.fa-shop .shop-buy.is-off {
  background: #DCD3C4;
  border-color: rgba(26,18,36,0.5);
  box-shadow: none;
  color: rgba(26,18,36,0.78);
  --fa-ic-ink: rgba(26,18,36,0.78);
  cursor: not-allowed;
}
.fa-shop .shop-buy.is-off:hover { filter: none; }
.fa-shop .shop-buy.is-off:active { transform: none; }

/* ── The reason ───────────────────────────────────────────────────────────── */
.fa-shop .shop-why {
  margin: 5px 0 0;
  padding: 7px 9px;
  background: rgba(26,18,36,0.055);
  border-radius: 10px;
  font-family: 'Heebo', sans-serif;
  font-weight: 700;
  font-size: clamp(0.7rem, 1.32vh, 0.78rem);
  line-height: 1.32;
  color: #40291A;
}
.fa-shop .shop-why-head {
  display: block;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: clamp(0.69rem, 1.2vh, 0.72rem);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  /* Same hue as the brand red, at a value that survives being type on a light plate.
     See the token comment in theme.ts: --ketchup as ink measures 4.17 and this 5.9. */
  color: var(--ketchup-ink);
}

/* ── Held inventory ───────────────────────────────────────────────────────── */
.fa-shop .shop-heldrow { display: flex; flex-wrap: wrap; gap: 7px; }
.fa-shop .shop-held {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 11px 5px 8px;
  background: linear-gradient(180deg, #FFFFFF 0%, #EFE2CC 100%);
  border: 3px solid var(--ink);
  border-radius: 999px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.3);
}
.fa-shop .shop-held-em { font-size: 1.35rem; line-height: 1; }
.fa-shop .shop-held-name {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.72rem, 1.4vh, 0.82rem);
  color: var(--ink);
  white-space: nowrap;
}
.fa-shop .shop-held-n {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  /* The count badge takes the brand red at the DARKER of the two values theme.ts
     publishes. White on the fill red is 4.95:1 — over AA, and the lowest number on this
     whole screen for a run that is a bare integer with no second cue. The same hue one
     step down measures 6.96:1 and costs nothing: the badge still reads as the brand red
     against the cream chip it sits on. */
  background: var(--ketchup-ink);
  color: #FFFFFF;
  border: 2px solid var(--ink);
  border-radius: 999px;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: 0.72rem;
}

/* ── Bottom bar ───────────────────────────────────────────────────────────── */
.fa-shop .shop-bottom {
  display: flex;
  align-items: center;
  gap: clamp(8px, 1.6vw, 16px);
  min-height: var(--tap);
}
/* On the warm backdrop, so it takes the same cream-with-an-ink-stroke treatment the
   trophy road gives its own bottom-bar caption. A drop shadow sits UNDER the glyph and
   the stroke encloses it, so the type never meets the orange directly. */
.fa-shop .shop-foot-note {
  margin: 0;
  flex: 1 1 auto;
  min-width: 0;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.72rem, 1.55vh, 0.88rem);
  color: var(--cream);
  -webkit-text-stroke: 2px var(--ink);
  paint-order: stroke fill;
  text-shadow: 0 2px 0 rgba(26,18,36,0.75);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fa-shop .shop-foot-actions { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }

/* The free chest carries no price row, so nothing pushed its footer down and it ended
   with a block of dead card under it while the four boxes beside it were full. */
.fa-shop .shop-card--free .shop-why { margin-top: auto; }

/* ── Landscape phone ──────────────────────────────────────────────────────── */
/* 390px tall is THE tight case, and this block is a fix rather than a polish pass: the
   first landscape capture spent every one of its ~278 available pixels on the banner,
   the held-box row and two section headings, and the player reached the bottom of the
   frame before the first price. What is cut, and why each cut is safe:
   * the heading, which duplicates the tab that was just pressed;
   * the banner's SECOND sentence only. The claim that nothing is for sale and the
     reason it is not both stay. Losing "everything below is real" costs elaboration,
     not honesty, and the per-card refusal below still carries the arithmetic;
   * the held-box row, which is the same information the trophy road's own bottom bar
     shows, one tap away through the button in this screen's footer. Home takes exactly
     this decision at exactly this breakpoint for exactly this reason;
   * the blurb and the pool lists, which are prose restatements of the odds rows that
     stay. Nothing that is only said once is cut. */
/* ⚠️ The rarity disclosure is two more lines in this band, and it MEASURABLY pushed the
   first price off the bottom of the frame — the exact defect this block was written to
   fix, re-created by the sentence added above it (screen_metrics: runs in view 46 -> 39,
   scrolled out 6 -> 13, and the price row visibly clipped in
   shots/screen_m/loose/after-shop-phone-land.png). It is a disclosure on a priced
   surface, so it is not the thing that gives way. Two cheaper cuts pay for it, one per
   card, and both follow the rule already stated above — nothing that is only said once:
   * 'WHAT IS INSIDE', a heading over rows that each already read "<what> <percent>",
     inside a card that already carries the box's own name;
   * the tighter leading, which costs nothing at all. */
@media (max-height: 460px) {
  .fa-shop .shop-heading { display: none; }
  .fa-shop .shop-notice-more { display: none; }
  .fa-shop .shop-inv { display: none; }
  .fa-shop .shop-blurb { display: none; }
  .fa-shop .shop-pool { display: none; }
  .fa-shop .shop-oddshead { display: none; }
  .fa-shop .shop-section-title::after { display: none; }
  .fa-shop .shop-notice { padding: 7px 10px; line-height: 1.3; }
  .fa-shop .shop-rarity { line-height: 1.24; }
  .fa-shop .shop-scroll { gap: 7px; padding: 8px; }
  .fa-shop .shop-card { padding: 9px 10px 10px; gap: 4px; }
}

/* ── Portrait phone ───────────────────────────────────────────────────────── */
/* Deliberately a SEPARATE block from the rule above and not nested inside it.
   'characterSelect.ts' shipped a portrait media query nested inside a landscape one,
   so a 430x932 phone matched neither and got no portrait layout at all — valid
   TypeScript, valid CSS-in-a-string, and invisible to every parser in the toolchain. */
/* MEASURED, not guessed. At 430x932 with a simulated notch the usable width is
   430 - 44 - 44 - 2 gutters = 322px, and the two footer buttons are 'white-space:
   nowrap' with 'padding: 0 clamp(14px, 2vw, 30px)' each. A flex item's default
   'min-width: auto' resolves to MIN-CONTENT, so 'flex: 1 1 0' could not shrink them
   past their own labels and the second button was drawn 20px off the right edge of the
   frame. 'document.scrollWidth' reported 430 in exactly that state, because '.fa-root'
   clips — which is why this was caught by measuring element rects and could never have
   been caught by the page-overflow assertion. Same defect family as the three portrait
   bugs found at HEAD. */
@media (max-width: 700px) {
  .fa-shop .shop-bottom { flex-wrap: wrap; }
  .fa-shop .shop-foot-note { flex-basis: 100%; }
  .fa-shop .shop-foot-actions { flex: 1 1 auto; flex-wrap: wrap; }
  .fa-shop .shop-foot-actions .fa-btn {
    flex: 1 1 46%;
    min-width: 0;
    padding: 0 10px;
  }
}

/* At 430px the top bar is Back + a title + two currency chips, which is more content
   than the frame has. The chips are the numbers the player came to read; the title
   duplicates the control they pressed. Same reasoning the trophy road uses on the same
   axis, and the same threshold, so the two screens shrink identically. */
@media (max-width: 520px) {
  .fa-shop .shop-heading { display: none; }
}
`;
