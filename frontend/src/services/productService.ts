import { serverApiBaseUrl } from '@/src/lib/apiBase';
import {
  unwrapCollection,
  type ApiEnvelope,
  type Paginated,
  type Product,
} from '@/src/types/product';

/**
 * Server-side catalog access.
 *
 * Uses the native fetch (not the Axios client in src/lib/api.ts) so it can opt
 * into Next's data cache: `revalidate: 30` keeps product pages fresh within
 * half a minute without hammering Laravel on every request.
 *
 * Addresses are resolved through src/lib/apiBase.ts, which prefers
 * LARAVEL_INTERNAL_URL — these calls run inside the nextjs.app container, where
 * the host-published port in NEXT_PUBLIC_API_URL is not reachable.
 */
const REVALIDATE_SECONDS = 30;

/** Shared entry point so every product endpoint caches identically. */
async function catalogFetch(path: string): Promise<Response> {
  return fetch(`${serverApiBaseUrl()}${path}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: REVALIDATE_SECONDS },
  });
}

/**
 * Fetches one product by slug.
 *
 * @returns the product, or `null` when the API answers 404 (the caller turns
 *          that into `notFound()`).
 * @throws  Error on any other failure — a 500 or an unreachable API is an
 *          infrastructure problem and must not masquerade as "no such page".
 */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  const response = await catalogFetch(`/products/${encodeURIComponent(slug)}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Failed to load product "${slug}" (HTTP ${response.status}).`,
    );
  }

  const payload = (await response.json()) as ApiEnvelope<Product>;

  return payload?.data ?? null;
}

/**
 * Fetches the storefront's product listing (GET /api/v1/products).
 *
 * Tolerates both a plain array and a Laravel paginator, so the API is free to
 * add paging later without a frontend change.
 *
 * @throws Error when the catalog cannot be read — an empty grid would be
 *         indistinguishable from "the shop is empty".
 */
export async function getAllProducts(): Promise<Product[]> {
  const response = await catalogFetch('/products');

  if (!response.ok) {
    throw new Error(
      `Failed to load the product catalog (HTTP ${response.status}).`,
    );
  }

  const payload = (await response.json()) as ApiEnvelope<
    Product[] | Paginated<Product>
  >;

  return unwrapCollection(payload?.data);
}
