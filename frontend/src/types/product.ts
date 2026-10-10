/**
 * Catalog API contracts.
 *
 * Mirrors the Laravel response shape used by the rest of this API:
 *   { "success": true, "message": "...", "data": { ... } }
 * (see backend/app/Support/ApiResponse.php). Resource keys are snake_case,
 * exactly as they leave App\Http\Resources\*.
 */

/** Standard Laravel envelope shared by every endpoint. */
export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * Paginated payload built explicitly by ProductController::paginatedPayload
 * (NOT Laravel's default paginator — ApiResponse's envelope bypasses the
 * response pipeline that attaches links/meta, so the controller assembles
 * them by hand):
 *
 *   data: { data: [...rows], meta: {...}, links: {...} }
 */
export interface Paginated<T> {
  data: T[];
  meta: {
    current_page: number;
    per_page: number;
    last_page: number;
    total: number;
    from: number | null;
    to: number | null;
  };
  links: {
    first: string | null;
    prev: string | null;
    next: string | null;
    last: string | null;
  };
}

/**
 * Returns the rows from a collection endpoint regardless of whether the
 * controller paginated, so list endpoints can be switched to `paginate()`
 * without breaking the storefront.
 */
export function unwrapCollection<T>(
  payload: T[] | Paginated<T> | null | undefined,
): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload.data) ? payload.data : [];
}

/** Query accepted by GET /api/v1/products (see ProductIndexRequest). */
export interface ProductQuery {
  search?: string;
  category?: string;
  in_stock?: boolean;
  page?: number;
  per_page?: number;
}

/** Environment presets available to drei's <Environment /> / <Stage />. */
export type LightingPreset =
  | 'sunset'
  | 'dawn'
  | 'night'
  | 'warehouse'
  | 'forest'
  | 'apartment'
  | 'studio'
  | 'city'
  | 'park'
  | 'lobby';

/**
 * Per-category theming, stored as a JSON column (`categories.theme_config`)
 * and consumed for buttons, badges and container glows.
 */
export interface CategoryTheme {
  /** Main action colour (buttons, price, active states). */
  primary_color: string;
  /** Ambient halo colour used for glows and shadows. */
  glow_color: string;
  /** Optional tertiary highlight (badges, borders). */
  accent_color?: string;
  /** Optional viewer backdrop. Falls back to the storefront's midnight blue. */
  background_color?: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  /** Nullable: a category may ship without custom theming. */
  theme_config: CategoryTheme | null;
}

/**
 * Camera framing persisted alongside the 3D media row (snake_case, as it is
 * serialised by the API). Mapped to the viewer's CameraSettings on the client.
 */
export interface Media3DCameraSettings {
  position?: [number, number, number];
  target?: [number, number, number];
  fov?: number;
  min_distance?: number;
  max_distance?: number;
  auto_rotate_speed?: number;
}

/** The toy's 3D asset (MinIO `models/` prefix behind `media_3d.url`). */
export interface Media3D {
  id: number;
  /** Public .glb/.gltf URL, e.g. MINIO/toy-store-assets/models/duck.glb */
  url: string;
  /** 'glb' | 'gltf' — kept as string so new formats don't break the client. */
  format: string;
  alt_text?: string | null;
  thumbnail_url?: string | null;
  file_size?: number | null;
  lighting_preset?: LightingPreset | null;
  camera_settings?: Media3DCameraSettings | null;
}

/** A single dynamic toy attribute. */
export type ProductAttributeValue = string | number | boolean;

/**
 * Attributes arrive as a JSON column. Either a key→value map
 * (`{ "Material": "ABS", "Age": "3+" }`) or a list of pairs is accepted;
 * use `toAttributeEntries()` to normalise both before rendering.
 */
export interface ProductAttribute {
  key: string;
  value: ProductAttributeValue;
}

export type ProductAttributes =
  | Record<string, ProductAttributeValue>
  | ProductAttribute[];

/** Product row, exactly as App\Http\Resources\ProductResource serialises it. */
export interface Product {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  /**
   * Integer toman, or `null`.
   *
   * Null is not "free": it means this row has no chargeable toman amount —
   * typically a legacy row whose original amount was preserved in USD. The API
   * never sends a rounded stand-in, so `12.99` arrives as `null` and not `12`.
   */
  price: number | null;
  compare_at_price?: number | null;
  /**
   * The amount's own currency: `'IRT'` for every sellable row, `'USD'` for a
   * preserved legacy one. Never assumed — always read.
   */
  currency?: string | null;
  /**
   * The server's answer to "may this be added to a cart and charged?".
   * Authoritative: the storefront gates its add-to-cart on it so the UI and
   * the checkout service can never disagree. See {@link isPurchasable()}.
   */
  purchasable?: boolean;
  /**
   * Preserved, verbatim original amount for a row that is not purchasable
   * (e.g. `'12.99'`). Null for clean toman rows. Shown with its own currency
   * rather than relabelled as toman.
   */
  legacy_price?: string | null;
  legacy_compare_at_price?: string | null;
  legacy_currency?: string | null;
  stock: number;
  is_active?: boolean;
  attributes: ProductAttributes | null;
  category: Category | null;
  media_3d: Media3D | null;
  created_at?: string | null;
  updated_at?: string | null;
}

/** A product the server has confirmed may be charged in toman right now. */
export type PurchasableProduct = Product & { price: number };

/**
 * Can this product enter a cart (and therefore an IRT calculation)?
 *
 * Prefers the server's `purchasable` flag, which mirrors the checkout guard.
 * A payload without that flag fails closed: an amount is only treated as toman
 * when the row actually says so, because assuming "no currency means toman" is
 * exactly how `12.99 USD` became `۱۲ تومان`.
 *
 * Narrows `price` to a number, so callers can multiply without a null check.
 */
export function isPurchasable(product: Product): product is PurchasableProduct {
  if (typeof product.purchasable === 'boolean') {
    return product.purchasable && typeof product.price === 'number';
  }

  return (
    (product.currency ?? '').trim().toUpperCase() === 'IRT' &&
    typeof product.price === 'number' &&
    Number.isSafeInteger(product.price) &&
    product.price >= 0
  );
}

/**
 * Normalises either attribute shape into ordered [label, value] pairs so the
 * page can render one code path.
 */
export function toAttributeEntries(
  attributes?: ProductAttributes | null,
): Array<[string, ProductAttributeValue]> {
  if (!attributes) return [];
  if (Array.isArray(attributes)) {
    return attributes.map((attr) => [attr.key, attr.value]);
  }
  return Object.entries(attributes);
}
