/**
 * Regression tests for catalog discovery.
 *
 * The gap these guard: the 3D products existed only at their own URLs. A card
 * that builds the wrong href, a nav that never mentions `/products`, or a
 * category-less product that renders an empty badge gap all silently cost a
 * product its discoverability — none of them throw.
 *
 * `src/lib/catalog.ts` is therefore the only place these routes, labels and
 * navigation lists are defined, and this file pins them:
 *
 *   1. every route is built from the product/category *slug*,
 *   2. the catalog is reachable from the header and the footer, and
 *   3. a product with no category says so instead of rendering nothing.
 *
 * Run with:  node --test frontend/tests/catalogDiscovery.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ALL_CATEGORIES_PATH,
  ALL_PRODUCTS_PATH,
  categoryLabel,
  categoryPath,
  FOOTER_QUICK_LINKS,
  has3DModel,
  HEADER_NAV_LINKS,
  productPath,
  UNCATEGORISED_LABEL,
  VIEW_MODEL_LABEL,
} from '../src/lib/catalog.ts';
import type { Media3D, Product } from '../src/types/product.ts';

/** The eight ingested fixtures — the products this phase made discoverable. */
const FIXTURE_SLUGS = [
  '9mm-blaster-pistol',
  'ak-47-blaster-rifle',
  'classic-rubber-duck',
  'ford-mustang-1965',
  'porsche-911-turbo-1975',
  'porsche-911-carrera-4s',
  'colt-python-revolver',
  'halo-smg-blaster',
];

function media(overrides: Partial<Media3D> = {}): Media3D {
  return {
    id: 1,
    url: 'http://localhost:9000/toy-store-assets/models/duck.glb',
    format: 'glb',
    alt_text: null,
    thumbnail_url: null,
    file_size: 42_752,
    lighting_preset: 'studio',
    camera_settings: null,
    ...overrides,
  };
}

test('a product route is built from the slug the API resolves', () => {
  assert.equal(ALL_PRODUCTS_PATH, '/products');
  assert.equal(ALL_CATEGORIES_PATH, '/categories');

  for (const slug of FIXTURE_SLUGS) {
    assert.equal(productPath(slug), `/products/${slug}`);
  }

  // Distinct routes: no slug may collapse onto another product's page.
  const paths = FIXTURE_SLUGS.map(productPath);
  assert.equal(new Set(paths).size, FIXTURE_SLUGS.length);

  assert.equal(categoryPath('model-cars'), '/categories/model-cars');
  assert.equal(categoryPath('blasters'), '/categories/blasters');
});

test('the catalog is reachable from the header and the footer', () => {
  const headerHrefs = HEADER_NAV_LINKS.map((link) => link.href);
  const footerHrefs = FOOTER_QUICK_LINKS.map((link) => link.href);

  assert.ok(headerHrefs.includes(ALL_PRODUCTS_PATH), 'header must link the full catalog');
  // The footer is the only navigation a phone sees, so it needs the link too.
  assert.ok(footerHrefs.includes(ALL_PRODUCTS_PATH), 'footer must link the full catalog');
  assert.ok(headerHrefs.includes(ALL_CATEGORIES_PATH), 'header must link the categories');
  assert.ok(footerHrefs.includes(ALL_CATEGORIES_PATH), 'footer must link the categories');

  // Home stays first — it is the primary navigation, not an alphabetical list.
  assert.equal(HEADER_NAV_LINKS[0]?.href, '/');

  for (const links of [HEADER_NAV_LINKS, FOOTER_QUICK_LINKS]) {
    for (const link of links) {
      assert.ok(link.label.trim().length > 0, `link ${link.href} has no label`);
      assert.ok(link.href.startsWith('/'), `link ${link.href} is not an app route`);
    }

    assert.equal(
      new Set(links.map((link) => link.href)).size,
      links.length,
      'the same destination must not appear twice',
    );
  }
});

test('a product with no category is labelled, never left blank', () => {
  assert.equal(categoryLabel(null), UNCATEGORISED_LABEL);
  assert.equal(categoryLabel(undefined), UNCATEGORISED_LABEL);
  // A whitespace-only name is a missing name, not a badge with a space in it.
  assert.equal(categoryLabel({ name: '   ' }), UNCATEGORISED_LABEL);

  assert.equal(categoryLabel({ name: 'Model Cars' }), 'Model Cars');
});

test('only a product with a loadable model advertises one', () => {
  assert.equal(VIEW_MODEL_LABEL.trim().length > 0, true);

  const withModel = { media_3d: media() } as Pick<Product, 'media_3d'>;
  const withoutMedia = { media_3d: null } as Pick<Product, 'media_3d'>;
  // A media row with no stored file is "no model": the API drops such rows and
  // the viewer would render an empty canvas.
  const withoutFile = {
    media_3d: { ...media(), url: undefined } as unknown as Media3D,
  } as Pick<Product, 'media_3d'>;

  assert.equal(has3DModel(withModel), true);
  assert.equal(has3DModel(withoutMedia), false);
  assert.equal(has3DModel(withoutFile), false);
});
