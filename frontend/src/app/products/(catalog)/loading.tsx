import Container from '@/src/components/ui/Container';
import Skeleton from '@/src/components/ui/Skeleton';

/**
 * Loading state for the `/products` segment.
 *
 * Next renders this while the listing's server fetch is in flight, so a slow
 * API shows the shape of the grid instead of a blank page.
 */
export default function ProductsLoading() {
  return (
    <Container className="py-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">در حال بارگذاری فهرست محصولات</span>

      <Skeleton className="h-5 w-40" />
      <Skeleton className="mt-4 h-9 w-56" />
      <Skeleton className="mt-3 h-4 w-full max-w-xl" />

      <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <li key={index}>
            <Skeleton className="h-80 w-full rounded-lg" />
          </li>
        ))}
      </ul>
    </Container>
  );
}
