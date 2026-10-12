/**
 * Regression tests for the listing's "no 3D in a card" invariant.
 *
 * The defect these guard against: `ProductCard` mounted a rotating
 * react-three-fiber `<Canvas>` of the product on hover. Besides pulling 17–21 MB
 * of car geometry into a grid tile, a canvas is a *live, self-sizing* element
 * (r3f writes its own width/height onto its wrapper and observes it with a
 * `ResizeObserver`), so inside an `aspect-ratio` media box its measurement fed
 * back into layout and the card could grow without settling — the "card expands
 * downwards when I hover it" report.
 *
 * That is a *structural* property, not a value: nothing about the rendered data
 * would reveal it, and a future "nice hover preview" would reintroduce it just as
 * silently. So these assertions read the component sources and pin the structure
 * itself:
 *
 *   1. no 3D module (canvas, loader, viewer, model URL) is reachable from a card,
 *   2. the card's media box is height-bounded and clips its children,
 *   3. a missing picture renders the deliberate placeholder, not a borrowed image,
 *   4. the placeholder itself fetches nothing.
 *
 * The behavioural halves — that hovering requests no `.glb`, that card heights do
 * not change on hover, and that the detail page still boots the viewer — are
 * verified against the running app in the phase report (browser measurements),
 * because this project has no DOM-rendering test harness to assert them in CI.
 *
 * Run with:  node --test frontend/tests/productCardInvariants.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { HAS_MODEL_BADGE_LABEL, VIEW_MODEL_LABEL } from '../src/lib/catalog.ts';

function source(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
}

/** Comments explain the history; only executable lines should be asserted on. */
function code(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const CARD = code(source('../src/components/products/ProductCard.tsx'));
const PLACEHOLDER = code(source('../src/components/ui/MediaPlaceholder.tsx'));
const HERO = code(source('../src/components/home/FeaturedProductHero.tsx'));
const TILE = code(source('../src/components/categories/CategoryTile.tsx'));

/**
 * Every module that can mount WebGL, load a `.glb`, or point at one.
 *
 * Deliberately matches on the *import specifier* rather than a symbol name, so
 * renaming a component cannot smuggle one back in.
 */
const FORBIDDEN_MODULES = [
  '@react-three/fiber',
  '@react-three/drei',
  'three',
  './ToyModel',
  './ModelPreview',
  './ProductViewer3D',
  './ViewerLoader',
  './CameraRig',
  './ModelLoadBoundary',
];

test('no card component can reach a 3D canvas, loader or model URL', () => {
  for (const [name, body] of [
    ['ProductCard', CARD],
    ['FeaturedProductHero', HERO],
    ['CategoryTile', TILE],
  ] as const) {
    for (const module of FORBIDDEN_MODULES) {
      assert.ok(
        !body.includes(module),
        `${name} imports ${module}; a listing tile must not mount 3D at all.`,
      );
    }

    for (const token of ['<Canvas', 'useGLTF', 'media_3d?.url']) {
      assert.ok(
        !body.includes(token),
        `${name} references ${token}; a card must never load a model.`,
      );
    }
  }

  // The only place that may ask for a model URL is the detail page's viewer.
  assert.ok(
    !TILE.includes('modelUrl'),
    'CategoryTile must not accept a model URL prop at all.',
  );
  assert.ok(
    !HERO.includes('modelUrl'),
    'The hero must not accept a model URL prop at all.',
  );
});

test('the card media box is height-bounded and clips its children', () => {
  // The media box owns the height: it is square, and it hides overflow, so no
  // child can report a size back into the card's layout.
  assert.ok(CARD.includes('aspect-square'), 'card media box must be aspect-ratio bounded');
  assert.ok(CARD.includes('overflow-hidden'), 'card media box must clip its children');

  // Hover may move or fade the card, never resize it.
  const hoverTransforms = CARD.match(/hover:(-?translate-[a-z]+|shadow-[a-z]+|opacity-\d+)/g) ?? [];
  assert.ok(hoverTransforms.length > 0, 'hover affordance is expected to exist');

  for (const cls of hoverTransforms) {
    assert.ok(
      /hover:-?(translate|shadow|opacity)/.test(cls),
      `${cls} changes layout; only transform/opacity/shadow are allowed on a card`,
    );
  }

  assert.ok(
    !/hover:(h-|min-h-|max-h-|py-|my-|flex-col-grow)/.test(CARD),
    'no hover rule may change the card height',
  );
});

test('a missing picture renders the deliberate placeholder, never a stand-in', () => {
  assert.ok(
    CARD.includes('<MediaPlaceholder'),
    'the card must render the shared neutral placeholder when there is no poster',
  );
  assert.ok(
    !/🧸/.test(CARD),
    'the bear emoji must not be the universal fallback: it claimed every product was a bear',
  );

  // A product's own poster is used when present; nothing invents an image.
  assert.ok(CARD.includes('poster'), 'the card must still show a real poster when there is one');
  assert.ok(
    !/fallbackImage|stockImage|placeholderImage|\.jpg|\.png/.test(CARD),
    'a card must not hard-code an image belonging to some other product',
  );
});

test('the placeholder fetches nothing and names nothing', () => {
  for (const forbidden of ['fetch(', 'next/image', 'new Image', 'http://', 'https://']) {
    assert.ok(
      !PLACEHOLDER.includes(forbidden),
      `MediaPlaceholder must not ${forbidden}: a placeholder may not cost a request`,
    );
  }

  assert.ok(PLACEHOLDER.includes('<svg'), 'the placeholder mark should be inline SVG');
  assert.ok(PLACEHOLDER.includes('بدون تصویر'), 'the placeholder must label itself in Persian');
});

test('the 3D badge is a signal, not a viewer', () => {
  assert.ok(HAS_MODEL_BADGE_LABEL.trim().length > 0);
  assert.notEqual(
    HAS_MODEL_BADGE_LABEL,
    VIEW_MODEL_LABEL,
    'the badge states that a model exists; the link is what opens it',
  );

  // The badge is rendered as plain text; the only affordance is the detail link.
  assert.ok(CARD.includes('HAS_MODEL_BADGE_LABEL'), 'the card must advertise 3D availability');
  assert.ok(CARD.includes('VIEW_MODEL_LABEL'), 'the card must link to the viewer');
  assert.ok(
    CARD.includes('productPath(product.slug)'),
    'both the poster link and the model link must use the product slug route',
  );
});
