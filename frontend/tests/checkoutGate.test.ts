/**
 * Regression tests for the checkout fail-closed gate.
 *
 * The scenario these guard: a cart contains a preserved legacy-USD product and
 * a priced toman product. `buildQuote()` excludes the legacy line from the
 * subtotal (correct — it has no toman amount), but checkout used to submit
 * only the priced lines, so the excluded item vanished while checkout looked
 * perfectly valid. `checkoutGate()` must report that state as blocked so the
 * checkout page refuses with a clear domain-level error instead.
 *
 * Run with:  node --test frontend/tests/checkoutGate.test.ts
 * (Node 23+ strips the TypeScript types natively; no test framework needed.)
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { checkoutGate } from '../src/services/checkoutGate.ts';
import type { CartQuote, CartQuoteLine } from '../src/services/cartQuote.ts';

function makeQuote(overrides: {
  lines?: CartQuoteLine[];
  missingIds?: number[];
  unavailableSlugs?: string[];
}): CartQuote {
  const lines = overrides.lines ?? [];

  return {
    lines,
    missingIds: overrides.missingIds ?? [],
    unavailableSlugs: overrides.unavailableSlugs ?? [],
    subtotal: lines.reduce((sum, line) => sum + line.lineTotal, 0),
    totalItems: lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}

/** A priced toman line, so fixtures can represent a partially-excluded cart. */
function pricedLine(): CartQuoteLine {
  return {
    product: {
      id: 1,
      title: 'Priced toy',
      slug: 'priced-toy',
      description: null,
      price: 1_299_000,
      currency: 'IRT',
      purchasable: true,
      stock: 5,
      attributes: null,
      category: null,
      media_3d: null,
    } as CartQuoteLine['product'],
    quantity: 1,
    lineTotal: 1_299_000,
  };
}

test('a fully priced quote is not blocked', () => {
  const gate = checkoutGate(makeQuote({ lines: [pricedLine()] }));

  assert.equal(gate.blocked, false);
  assert.equal(gate.reason, null);
  assert.deepEqual(gate.unavailableSlugs, []);
  assert.deepEqual(gate.missingIds, []);
});

test('an excluded legacy-USD line blocks checkout even when other lines are priced', () => {
  // The regression: the priced line made checkout look valid while the
  // unorderable line was silently dropped from the submission.
  const gate = checkoutGate(
    makeQuote({
      lines: [pricedLine()],
      unavailableSlugs: ['legacy-duck'],
    }),
  );

  assert.equal(gate.blocked, true);
  assert.equal(gate.reason, 'cart_contains_unorderable_lines');
  assert.deepEqual(gate.unavailableSlugs, ['legacy-duck']);
});

test('a vanished product (missing id) blocks checkout', () => {
  const gate = checkoutGate(
    makeQuote({ lines: [pricedLine()], missingIds: [42] }),
  );

  assert.equal(gate.blocked, true);
  assert.equal(gate.reason, 'cart_contains_unorderable_lines');
  assert.deepEqual(gate.missingIds, [42]);
});

test('an empty but clean quote is not blocked (the cart-empty branch owns it)', () => {
  const gate = checkoutGate(makeQuote({}));

  assert.equal(gate.blocked, false);
  assert.equal(gate.reason, null);
});

test('a missing quote fails closed', () => {
  const gate = checkoutGate(null);

  assert.equal(gate.blocked, true);
  assert.equal(gate.reason, 'quote_unavailable');
});
