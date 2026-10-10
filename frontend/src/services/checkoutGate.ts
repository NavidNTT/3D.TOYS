import type { CartQuote } from './cartQuote';

/**
 * Why checkout must not proceed.
 *
 *  - `cart_contains_unorderable_lines` — the quote refused to price at least
 *    one line the customer still has in their cart (a preserved legacy-USD row,
 *    an unpublished product, or a product that no longer exists). Submitting
 *    the remaining lines would silently drop those items while checkout looks
 *    valid, so the whole checkout is blocked until the customer removes them.
 *  - `quote_unavailable` — there is no quote to trust at all.
 */
export type CheckoutBlockedReason =
  | 'cart_contains_unorderable_lines'
  | 'quote_unavailable';

export interface CheckoutGate {
  /** `true` when checkout must be refused outright. */
  blocked: boolean;
  /** Machine-readable domain reason, `null` when checkout may proceed. */
  reason: CheckoutBlockedReason | null;
  /** Slugs the server refused to price (legacy currency or unpublished). */
  unavailableSlugs: string[];
  /** Product ids that vanished from the catalog (404 during the quote). */
  missingIds: number[];
}

/**
 * The fail-closed half of the cart/checkout money contract.
 *
 * `buildQuote()` deliberately excludes lines it cannot price instead of
 * failing the whole quote — that keeps the cart page usable, where the
 * exclusion is surfaced with an offer to remove the line. The checkout page
 * has no such affordance: it would submit only the priced lines and create a
 * valid-looking order that never mentions the excluded ones. This gate makes
 * that state explicit so checkout can refuse with a clear domain error.
 */
export function checkoutGate(quote: CartQuote | null): CheckoutGate {
  if (quote === null) {
    return {
      blocked: true,
      reason: 'quote_unavailable',
      unavailableSlugs: [],
      missingIds: [],
    };
  }

  const unavailableSlugs = [...quote.unavailableSlugs];
  const missingIds = [...quote.missingIds];
  const blocked = unavailableSlugs.length > 0 || missingIds.length > 0;

  return {
    blocked,
    reason: blocked ? 'cart_contains_unorderable_lines' : null,
    unavailableSlugs,
    missingIds,
  };
}

export default checkoutGate;
