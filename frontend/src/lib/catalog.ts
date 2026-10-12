import type { Category, Product } from '@/src/types/product';

/**
 * Catalog discovery: where a product lives, where its category lives, how both
 * are labelled, and how a visitor reaches the catalog at all.
 *
 * The storefront had three ways to build a product URL (card, page, viewer) and
 * a fourth place — the API — that resolves one from a slug. Every one of them
 * has to agree, or a card links somewhere the router cannot resolve. Paths,
 * labels and the navigation lists are therefore defined once, here, and imported
 * by the components and by `tests/catalogDiscovery.test.ts`.
 *
 * Slugs are the stable identity: the API routes on them, the sitemap-shaped URLs
 * are built from them, and they are never derived from a title (a title is copy,
 * and copy changes).
 *
 * This module deliberately imports nothing at runtime — its only import is a
 * type — so `node --test` can load it directly, without the Next bundler and
 * without the `@/src` alias.
 */

/** The all-products catalog. */
export const ALL_PRODUCTS_PATH = '/products';
export const ALL_PRODUCTS_LABEL = 'همه محصولات';

/** The category index. */
export const ALL_CATEGORIES_PATH = '/categories';
export const ALL_CATEGORIES_LABEL = 'دسته‌بندی‌ها';

/** The home page, the first entry in the header's primary navigation. */
export const HOME_PATH = '/';
export const HOME_LABEL = 'خانه';

/** Shown on a card whose product genuinely has no category yet. */
export const UNCATEGORISED_LABEL = 'بدون دسته‌بندی';

/**
 * Explicit affordance for a product that has a 3D asset: the card says where a
 * model exists and takes the visitor to the viewer, instead of leaving a bare
 * canvas toggle as the only signal.
 */
export const VIEW_MODEL_LABEL = 'مشاهده مدل سه‌بعدی';

/**
 * Badge on a card whose product has a 3D asset.
 *
 * It is a *signal*, not a viewer: the card advertises that a model exists so the
 * visitor can follow the link to the detail page, and mounts nothing. The
 * listing must not pay for geometry or a WebGL context on hover.
 */
export const HAS_MODEL_BADGE_LABEL = 'مدل سه‌بعدی دارد';

/** Detail route for a product slug. */
export function productPath(slug: string): string {
  return `${ALL_PRODUCTS_PATH}/${slug}`;
}

/** Listing route for a category slug. */
export function categoryPath(slug: string): string {
  return `${ALL_CATEGORIES_PATH}/${slug}`;
}

/**
 * A usable category name, or an honest fallback.
 *
 * A product with no category is still a product — it is listed on the catalog
 * page and has a detail page — so a card must say "no category" rather than
 * render nothing and look like a data glitch.
 */
export function categoryLabel(
  category: Pick<Category, 'name'> | null | undefined,
): string {
  const name = category?.name?.trim();

  return name ? name : UNCATEGORISED_LABEL;
}

/**
 * Whether a product has a model the viewer can actually load.
 *
 * A `media_3d` row with no stored file is "no model" on purpose: the API already
 * drops such rows (see ProductResource::media3dPayload), and a card that
 * advertised one would open a broken canvas.
 */
export function has3DModel(product: Pick<Product, 'media_3d'>): boolean {
  return Boolean(product.media_3d?.url);
}

export interface NavLink {
  href: string;
  label: string;
}

/**
 * Primary navigation, rendered in the header on desktop.
 *
 * The catalog is the shop, so it sits directly after the home page: before this,
 * the only way to the full product list was to already know the URL.
 */
export const HEADER_NAV_LINKS: NavLink[] = [
  { href: HOME_PATH, label: HOME_LABEL },
  { href: ALL_PRODUCTS_PATH, label: ALL_PRODUCTS_LABEL },
  { href: ALL_CATEGORIES_PATH, label: ALL_CATEGORIES_LABEL },
  { href: '/about', label: 'درباره ما' },
];

/**
 * Footer quick links — the navigation a phone actually sees, since the header
 * collapses its menu on small screens.
 */
export const FOOTER_QUICK_LINKS: NavLink[] = [
  { href: ALL_PRODUCTS_PATH, label: ALL_PRODUCTS_LABEL },
  { href: ALL_CATEGORIES_PATH, label: ALL_CATEGORIES_LABEL },
  { href: '/about', label: 'درباره ما' },
  { href: '/contact', label: 'تماس با ما' },
  { href: '/returns', label: 'قوانین و بازگشت کالا' },
];
