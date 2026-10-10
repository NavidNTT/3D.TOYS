/**
 * Regression tests for the money contract on the public listing surface.
 *
 * The `/products` grid renders every row the API returns — including the six
 * preserved legacy-USD rows, whose payload is
 * `{ price: null, currency: 'USD', purchasable: false }`. These tests pin the
 * two rules the page depends on:
 *
 *   1. an amount is only ever rendered in its own currency (a USD value never
 *      gets the تومان suffix and a fractional amount is never rounded), and
 *   2. `isPurchasable()` is the gate the add-to-cart path uses, so a legacy row
 *      can never be added to a cart from the grid.
 *
 * Run with:  node --test frontend/tests/productListingPrice.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { formatPriceFa, hasAmount, UNPRICED_LABEL } from '../src/lib/format.ts';
import { isPurchasable, type Product } from '../src/types/product.ts';

/** A sellable toman row, as ProductResource serialises it. */
function pricedProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    title: 'Puzzle',
    slug: 'puzzle',
    description: null,
    price: 1_299_000,
    currency: 'IRT',
    purchasable: true,
    stock: 5,
    attributes: null,
    category: null,
    media_3d: null,
    ...overrides,
  };
}

/** A preserved legacy-USD row: real amount kept in legacy_*, price null. */
function legacyProduct(): Product {
  return pricedProduct({
    id: 2,
    title: 'Legacy Duck',
    slug: 'legacy-duck',
    price: null,
    currency: 'USD',
    purchasable: false,
    legacy_price: '12.99',
    legacy_compare_at_price: '16.99',
    legacy_currency: 'USD',
  });
}

test('a toman product renders with the toman suffix', () => {
  const product = pricedProduct();

  assert.equal(hasAmount(product.price, product.currency), true);
  assert.match(formatPriceFa(product.price, product.currency), /تومان$/);
});

test('a preserved legacy amount is never rendered as toman', () => {
  const product = legacyProduct();

  // The current price is null: the row genuinely has no toman amount.
  assert.equal(hasAmount(product.price, product.currency), false);
  assert.equal(formatPriceFa(product.price, product.currency), UNPRICED_LABEL);

  // The preserved amount is shown in its own currency, verbatim.
  assert.equal(formatPriceFa(product.legacy_price, product.legacy_currency), '$12.99');
  assert.doesNotMatch(formatPriceFa(product.legacy_price, product.legacy_currency), /تومان/);
});

test('a fractional amount is never truncated into a toman figure', () => {
  // 12.99 IRT is not a valid toman amount; `(int)` would have made it 12.
  assert.equal(formatPriceFa(12.99, 'IRT'), UNPRICED_LABEL);
  assert.doesNotMatch(formatPriceFa(12.99, 'IRT'), /۱۲/);
  assert.doesNotMatch(formatPriceFa(12.99, 'IRT'), /تومان/);
});

test('isPurchasable gates the add-to-cart path for legacy rows', () => {
  assert.equal(isPurchasable(legacyProduct()), false);
  assert.equal(isPurchasable(pricedProduct()), true);
  // Zero toman is a real, sellable amount — it is not the same as "no amount".
  assert.equal(isPurchasable(pricedProduct({ price: 0 })), true);
});

test('a payload without the purchasable flag still fails closed for non-toman', () => {
  const withoutFlag = { ...pricedProduct(), purchasable: undefined };

  assert.equal(isPurchasable(withoutFlag), true);
  assert.equal(isPurchasable({ ...withoutFlag, currency: 'USD' }), false);
  assert.equal(isPurchasable({ ...withoutFlag, price: null }), false);
  // A fractional amount can never be treated as a chargeable integer.
  assert.equal(isPurchasable({ ...withoutFlag, price: 12.99 }), false);
});
