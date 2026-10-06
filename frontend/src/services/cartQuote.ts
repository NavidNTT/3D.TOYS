import { serverApiBaseUrl } from '@/src/lib/apiBase';
import type { ApiEnvelope, Product } from '@/src/types/product';

/**
 * Server-priced cart quote.
 *
 * The persisted cart only stores `{productId, slug, quantity}` — never a price.
 * This helper resolves each line against the live catalog so every rendered
 * amount comes from the API. Lines whose product vanished or went unpublished
 * cannot be priced and are returned separately, so the UI can offer to remove
 * them instead of silently charging a stale snapshot.
 */

export interface CartQuoteLine {
  product: Product;
  quantity: number;
  lineTotal: number;
}

export interface CartQuote {
  lines: CartQuoteLine[];
  missingIds: number[];
  unavailableSlugs: string[];
  subtotal: number;
  totalItems: number;
}

/** Narrow an unknown value to a usable product row. */
function isProduct(value: unknown): value is Product {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === 'number' &&
    typeof candidate.slug === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.price === 'number' &&
    typeof candidate.stock === 'number'
  );
}

export interface QuoteRequestLine {
  productId: number;
  slug: string;
  quantity: number;
}

function clampQuantity(raw: unknown): number | null {
  const quantity = typeof raw === 'string' ? Number(raw) : raw;

  if (typeof quantity !== 'number' || !Number.isInteger(quantity)) return null;
  if (quantity < 1 || quantity > 99) return null;

  return quantity;
}

/**
 * Narrow an unknown payload to quote lines.
 *
 * Each line needs a numeric id, a non-empty slug (the price lookup key) and a
 * quantity inside the stepper's own 1–99 bounds. Anything else is a hand-built
 * request and is rejected whole.
 */
export function parseQuoteLines(value: unknown): QuoteRequestLine[] | null {
  if (typeof value !== 'object' || value === null) return null;

  const lines = (value as { lines?: unknown }).lines;

  if (!Array.isArray(lines) || lines.length === 0 || lines.length > 50) return null;

  const parsed: QuoteRequestLine[] = [];

  for (const line of lines) {
    if (typeof line !== 'object' || line === null) return null;

    const candidate = line as Record<string, unknown>;
    const quantity = clampQuantity(candidate.quantity);

    if (
      typeof candidate.productId !== 'number' ||
      !Number.isInteger(candidate.productId) ||
      candidate.productId <= 0 ||
      typeof candidate.slug !== 'string' ||
      candidate.slug.length === 0 ||
      candidate.slug.length > 255 ||
      quantity === null
    ) {
      return null;
    }

    parsed.push({
      productId: candidate.productId,
      slug: candidate.slug,
      quantity,
    });
  }

  // The checkout rejects a repeated product (distinct), so the quote does too:
  // duplicates would double-count the same line in the subtotal.
  const ids = new Set(parsed.map((line) => line.productId));

  if (ids.size !== parsed.length) return null;

  return parsed;
}

/**
 * Resolve every line against the live catalog and price it.
 *
 * Products are fetched by slug through the public detail endpoint (there is no
 * by-id catalog endpoint), with the storefront's 30s cache keeping a big cart
 * to a bounded number of cheap reads. Returns null only when the API itself is
 * unreachable — a single missing product resolves to its line being absent,
 * not to the whole quote failing.
 */
export async function buildQuote(
  lines: QuoteRequestLine[],
): Promise<CartQuote | null> {
  const settled = await Promise.all(
    lines.map(async (line) => {
      let response: Response;

      try {
        response = await fetch(
          `${serverApiBaseUrl()}/products/${encodeURIComponent(line.slug)}`,
          { headers: { Accept: 'application/json' }, cache: 'no-store' },
        );
      } catch {
        return null;
      }

      if (response.status === 404) {
        return { line, product: null as Product | null };
      }

      if (!response.ok) return null;

      const payload = (await response.json().catch(() => null)) as ApiEnvelope<Product> | null;
      const product = payload?.data ?? null;

      return { line, product: isProduct(product) ? product : null };
    }),
  );

  if (settled.some((entry) => entry === null)) return null;

  const quote: CartQuote = {
    lines: [],
    missingIds: [],
    unavailableSlugs: [],
    subtotal: 0,
    totalItems: 0,
  };

  for (const entry of settled) {
    if (entry === null) return null;

    const { line, product } = entry;

    if (product === null || product.id !== line.productId) {
      if (product === null) quote.missingIds.push(line.productId);
      else quote.unavailableSlugs.push(line.slug);
      continue;
    }

    if (product.is_active === false) {
      quote.unavailableSlugs.push(line.slug);
      continue;
    }

    const quantity = Math.min(line.quantity, 99);
    const lineTotal = product.price * quantity;

    quote.lines.push({ product, quantity, lineTotal });
    quote.subtotal += lineTotal;
    quote.totalItems += quantity;
  }

  return quote;
}

