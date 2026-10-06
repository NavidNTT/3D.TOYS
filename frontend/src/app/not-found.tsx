import Link from 'next/link';
import Container from '@/src/components/ui/Container';

/**
 * Root 404.
 *
 * Warm and playful rather than technical: the visitor sees a friendly way back
 * instead of a bare status code. (The product route has its own variant with
 * catalogue-specific copy.)
 */
export default function NotFound() {
  return (
    <Container className="py-20 text-center">
      <p className="text-6xl" aria-hidden>
        🧸
      </p>

      <h1 className="mt-6 font-display text-4xl text-ink">
        این صفحه پیدا نشد
      </h1>

      <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-ink/60">
        شاید نشانی اشتباه باشد یا این محصول دیگر موجود نباشد. از خانه شروع کنید
        یا سری به دسته‌بندی‌ها بزنید.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded-md bg-brand-500 px-6 py-3 text-sm font-bold text-white shadow-card transition hover:bg-brand-600"
        >
          بازگشت به خانه
        </Link>
        <Link
          href="/categories"
          className="rounded-md border border-ink/15 bg-surface px-6 py-3 text-sm font-bold text-ink/80 transition hover:bg-cream-100"
        >
          دسته‌بندی‌ها
        </Link>
      </div>
    </Container>
  );
}
