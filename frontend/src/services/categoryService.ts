import { serverApiBaseUrl } from '@/src/lib/apiBase';
import {
  unwrapCollection,
  type ApiEnvelope,
  type Category,
  type Paginated,
} from '@/src/types/product';

/**
 * Server-side category access (GET /api/v1/categories).
 *
 * Shares the caching and address rules of src/services/productService.ts: this
 * runs inside the nextjs.app container, so it resolves LARAVEL_INTERNAL_URL
 * over host-published ports, and caches for 30s.
 */
const REVALIDATE_SECONDS = 30;

/**
 * Fetches every category, each carrying its `theme_config`.
 *
 * @throws Error when the list cannot be read; the homepage would otherwise
 *         silently lose its navigation and per-category colours.
 */
export async function getAllCategories(): Promise<Category[]> {
  const response = await fetch(`${serverApiBaseUrl()}/categories`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to load categories (HTTP ${response.status}).`,
    );
  }

  const payload = (await response.json()) as ApiEnvelope<
    Category[] | Paginated<Category>
  >;

  return unwrapCollection(payload?.data);
}
