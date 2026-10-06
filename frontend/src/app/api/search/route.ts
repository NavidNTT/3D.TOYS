import { NextResponse } from 'next/server';
import { serverApiBaseUrl } from '@/src/lib/apiBase';
import { normalizeSearchTerm } from '@/src/lib/persian';
import {
  unwrapCollection,
  type ApiEnvelope,
  type Paginated,
  type Product,
} from '@/src/types/product';

/**
 * GET /api/search?q=&page=&limit=
 *
 * The command palette's live results. It proxies the public catalog search so
 * the browser never talks to Laravel directly (no CORS dependency, one place to
 * normalise the query), and forwards the API's own paging metadata so the full
 * results page and the palette agree on what a page is.
 *
 * The term is normalised here exactly as the backend normalises it, so an
 * Arabic kaf typed on one keyboard matches a Persian keheh stored in the data.
 */
export const dynamic = 'force-dynamic';

const UNREACHABLE_MESSAGE =
  'ارتباط با سرور برقرار نشد. لطفاً چند لحظه بعد دوباره تلاش کنید.';

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const rawQuery = url.searchParams.get('q') ?? '';
  const query = normalizeSearchTerm(rawQuery).slice(0, 100);
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const limit = Math.min(
    60,
    Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '8', 10) || 8),
  );

  if (query === '') {
    return NextResponse.json({
      success: true,
      message: '',
      data: { items: [], meta: null },
    });
  }

  const params = new URLSearchParams({
    search: query,
    page: String(page),
    per_page: String(limit),
  });

  let response: Response;

  try {
    response = await fetch(`${serverApiBaseUrl()}/products?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      // Live-as-you-type results must reflect the catalog within seconds; the
      // palette issues these on a debounce, so a short cache is enough.
      next: { revalidate: 5 },
    });
  } catch {
    return NextResponse.json(
      { success: false, message: UNREACHABLE_MESSAGE, data: null },
      { status: 502 },
    );
  }

  if (!response.ok) {
    return NextResponse.json(
      { success: false, message: UNREACHABLE_MESSAGE, data: null },
      { status: 502 },
    );
  }

  const payload = (await response.json()) as ApiEnvelope<
    Product[] | Paginated<Product>
  >;

  const data = payload?.data;

  if (data && !Array.isArray(data) && Array.isArray(data.data)) {
    return NextResponse.json({
      success: true,
      message: '',
      data: { items: data.data, meta: data.meta ?? null },
    });
  }

  return NextResponse.json({
    success: true,
    message: '',
    data: { items: unwrapCollection(data), meta: null },
  });
}
