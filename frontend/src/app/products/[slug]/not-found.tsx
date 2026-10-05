import Link from 'next/link';
import Container from '@/src/components/ui/Container';
import EmptyState from '@/src/components/ui/EmptyState';

/** Route-level 404 for a product slug that does not exist or is unpublished. */
export default function ProductNotFound() {
  return (
    <Container className="py-16">
      <EmptyState
        icon="🧩"
        title="این محصول پیدا نشد"
        description="ممکن است این اسباب‌بازی حذف شده باشد یا نشانی صفحه اشتباه باشد."
        action={
          <Link
            href="/"
            className="rounded-md bg-brand-500 px-5 py-3 text-sm font-bold text-white shadow-card transition hover:bg-brand-600"
          >
            بازگشت به خانه
          </Link>
        }
      />
    </Container>
  );
}
