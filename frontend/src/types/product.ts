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
 * Shape returned when a controller paginates: Laravel nests the rows under
 * `data` inside the envelope, alongside the paging metadata.
 */
export interface Paginated<T> {
  data: T[];
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
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

/** Product detail resource returned by GET /api/v1/products/{slug}. */
export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  compare_at_price?: number | null;
  /** ISO-4217 code; the storefront defaults to USD when null. */
  currency?: string | null;
  stock: number;
  is_active?: boolean;
  attributes: ProductAttributes | null;
  category: Category | null;
  media_3d: Media3D | null;
  created_at?: string | null;
  updated_at?: string | null;
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
