import Container from '@/src/components/ui/Container';
import Skeleton from '@/src/components/ui/Skeleton';

/**
 * Loading state for the `/products` segment.
 *
 * Next renders this while the listing's server fetch is in flight, so a slow
 * API shows the shape of the redesigned catalog — breadcrumb, intro panel,
 * search bar, category chips and the product grid — instead of a blank page.
 */
export default function ProductsLoading() {
  return (
    <Container className="py-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">در حال بارگذاری فهرست محصولات</span>

      {/* Breadcrumbs */}
      <Skeleton className="h-5 w-40" />

      {/* Intro panel — eyebrow, heading, copy lines, count pill */}
      <div className="mt-4 rounded-[2rem] bg-cream-100 px-5 py-8 sm:rounded-[2.5rem] sm:px-8 sm:py-10">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-4 h-9 w-56" />
        <Skeleton className="mt-4 h-4 w-full max-w-md" />
        <Skeleton className="mt-2 h-3 w-full max-w-sm" />
        <Skeleton className="mt-6 h-9 w-32 rounded-full" />
      </div>

      {/* Search / filter bar — input, submit, stock chip */}
      <div className="mt-6 rounded-lg bg-surface p-4 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Skeleton className="h-10 w-full rounded-lg sm:flex-1" />
          <Skeleton className="h-10 w-24 rounded-full sm:w-28" />
          <Skeleton className="h-10 w-36 rounded-full" />
        </div>
      </div>

      {/* Category chips */}
      <div className="mt-6 flex gap-3 overflow-hidden">
        <Skeleton className="h-9 w-28 shrink-0 rounded-full" />
        <Skeleton className="h-9 w-32 shrink-0 rounded-full" />
        <Skeleton className="h-9 w-24 shrink-0 rounded-full" />
        <Skeleton className="h-9 w-36 shrink-0 rounded-full" />
      </div>

      {/* Product grid */}
      <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <li key={index}>
            <Skeleton className="h-80 w-full rounded-lg" />
          </li>
        ))}
      </ul>
    </Container>
  );
}
