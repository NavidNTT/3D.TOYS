import Link from 'next/link';

/**
 * Page-based pagination for catalog grids.
 *
 * Server-rendered links (no client JS): each page is a real, shareable URL that
 * preserves the caller's other query params (e.g. `in_stock`). Renders nothing
 * when there is a single page, so callers never special-case that check.
 */

interface PaginationProps {
  currentPage: number;
  lastPage: number;
  /** Path without query, e.g. `/categories/toy-cars`. */
  basePath: string;
  /** Extra query params to keep on every link (search, filters). */
  params?: Record<string, string | undefined>;
}

/** Page numbers to show, with `null` marking an ellipsis gap. */
function pageWindow(current: number, last: number): Array<number | null> {
  if (last <= 7) {
    return Array.from({ length: last }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, last, current, current - 1, current + 1]);
  const sorted = [...pages]
    .filter((page) => page >= 1 && page <= last)
    .sort((a, b) => a - b);

  const result: Array<number | null> = [];
  let previous = 0;

  for (const page of sorted) {
    if (previous && page - previous > 1) result.push(null);
    result.push(page);
    previous = page;
  }

  return result;
}

export default function Pagination({
  currentPage,
  lastPage,
  basePath,
  params = {},
}: PaginationProps) {
  if (lastPage <= 1) return null;

  const hrefFor = (page: number): string => {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (value) query.set(key, value);
    }

    if (page > 1) query.set('page', String(page));

    const suffix = query.toString();

    return suffix ? `${basePath}?${suffix}` : basePath;
  };

  const linkClass =
    'rounded-md border border-ink/15 bg-surface px-3 py-2 text-sm font-bold text-ink/70 transition hover:bg-cream-100';

  return (
    <nav aria-label="صفحه‌بندی" className="mt-8 flex flex-wrap items-center justify-center gap-2">
      {currentPage > 1 && (
        <Link href={hrefFor(currentPage - 1)} className={linkClass} rel="prev">
          قبلی
        </Link>
      )}

      {pageWindow(currentPage, lastPage).map((page, index) =>
        page === null ? (
          <span key={`gap-${index}`} className="px-1 text-ink/40" aria-hidden>
            …
          </span>
        ) : (
          <Link
            key={page}
            href={hrefFor(page)}
            aria-current={page === currentPage ? 'page' : undefined}
            className={`tnum px-3 py-2 text-sm font-bold transition ${
              page === currentPage
                ? 'rounded-md bg-brand-500 text-white'
                : linkClass
            }`}
          >
            {new Intl.NumberFormat('fa-IR').format(page)}
          </Link>
        ),
      )}

      {currentPage < lastPage && (
        <Link href={hrefFor(currentPage + 1)} className={linkClass} rel="next">
          بعدی
        </Link>
      )}
    </nav>
  );
}
