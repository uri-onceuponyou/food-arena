/**
 * The real-money store — modelled, priced, fulfillable, and NOT LIVE.
 *
 * ── Read `STORE_AVAILABLE` in `tuning.ts` before touching this ──────────────
 * There is no payment processor, no checkout, no receipt validation, no entitlement
 * server. The UI renders every product DISABLED and says "Coming soon" on it. That
 * is the honest presentation of an unbuilt feature: a player knows exactly where
 * they stand. What must never be built is a Buy button that looks live and no-ops.
 *
 * ── Why the model exists ahead of the processor ─────────────────────────────
 * Fulfilment is the expensive part to retrofit, not the checkout. `grantProduct()`
 * below is precisely the function a Stripe webhook or an App Store receipt validator
 * would call once a purchase is verified — it is written, it is pure, and it is
 * tested. Wiring a processor later becomes: verify the receipt, call this, persist.
 * Not a rewrite of the economy.
 *
 * ── The compliance consequence, stated once ─────────────────────────────────
 * Real money buys GEMS. Gems buy BOXES. Boxes contain a RANDOMISED character. So the
 * moment this store goes live, the box drop rates are real-money loot-box odds and
 * must be disclosed. `containerOdds()` derives that disclosure from the same table
 * the roller uses, and the tests assert the two agree. See `containers.ts`.
 */

import {
  STORE_AVAILABLE,
  STORE_PRODUCTS,
  type StoreProduct,
  type StoreProductId,
} from './tuning.ts';
import { emptyReward, type Reward } from './reward.ts';

// NOTE: `StoreProduct` / `StoreProductId` are deliberately NOT re-exported here.
// `index.ts` does `export *` from both this file and `tuning.ts`, and re-exporting a
// type that already comes from `tuning.ts` is an ambiguous-export error rather than a
// harmless alias.

/** Whether a real-money purchase can be made at all. Always false today. */
export function storeAvailable(): boolean {
  return STORE_AVAILABLE;
}

export function storeProducts(): readonly StoreProduct[] {
  return STORE_PRODUCTS;
}

export function findProduct(id: StoreProductId): StoreProduct | undefined {
  return STORE_PRODUCTS.find((p) => p.id === id);
}

/**
 * Price as a display string.
 *
 * `Intl.NumberFormat` rather than a hand-rolled `$${(c/100).toFixed(2)}`, because
 * the day this ships outside the US the store front-end is the last place anyone
 * remembers to look. Locale-aware from the start costs nothing.
 */
export function formatPrice(priceUsdCents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
    .format(priceUsdCents / 100);
}

/**
 * Gems per dollar, used to derive the "+N% MORE" badge.
 *
 * Derived rather than authored so a price change cannot leave a stale bonus badge on
 * the card — which is a false advertising claim, not a typo.
 */
export function gemsPerDollar(product: StoreProduct): number {
  return product.priceUsdCents > 0 ? product.gems / (product.priceUsdCents / 100) : 0;
}

/**
 * Value uplift versus the cheapest gem tier, as a whole percent, or 0 for the base
 * tier and for anything that is not a straight gem pack.
 */
export function bonusPercent(product: StoreProduct): number {
  const packs = STORE_PRODUCTS.filter((p) => !p.oneTime && p.gems > 0);
  const base = packs.reduce(
    (lowest, p) => (p.priceUsdCents < lowest.priceUsdCents ? p : lowest),
    packs[0],
  );
  if (!base || product.id === base.id) return 0;
  const rate = gemsPerDollar(product) / gemsPerDollar(base);
  return Math.max(0, Math.round((rate - 1) * 100));
}

/**
 * What a purchased product hands over.
 *
 * THE FULFILMENT ENTRY POINT. A payment processor's verified-purchase callback calls
 * `grantReward(state, grantProduct(id))` and nothing else. It is deliberately
 * separate from anything that could be reached from a click: no UI path in this
 * codebase calls it, and `storeAvailable()` is false, so the only way a product can
 * currently be granted is from a test.
 */
export function grantProduct(id: StoreProductId): Reward {
  const product = findProduct(id);
  const reward = emptyReward();
  if (!product) return reward;
  reward.gems += product.gems;
  if (product.coins) reward.coins += product.coins;
  if (product.container) {
    reward.containers[product.container.kind] =
      (reward.containers[product.container.kind] ?? 0) + product.container.count;
  }
  return reward;
}
