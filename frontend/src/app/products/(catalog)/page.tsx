import type { Metadata } from 'next';
import Link from 'next/link';
import ProductCard from '@/src/components/products/ProductCard';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import Card from '@/src/components/ui/Card';
import Container from '@/src/components/ui/Container';
import EmptyState from '@/src/components/ui/EmptyState';
import Pagination from '@/src/components/ui/Pagination';
import { getProducts } from '@/src/services/productService';
import type { Product, Paginated } from '@/src/types/product';

/**
 * Public catalog listing (`/products`).
 *
 * Server-rendered from the existing paginated catalog endpoint, like the
 * category and search grids: the same `ProductCard`, the same currency-aware
 * `Price`, the same pagination control. Rendered per request so the grid
 * reflects live stock and the current price contract.
 *
 * The money contract is enforced by the shared components rather than here: a
 * row whose API payload is `price: null, currency: 'USD', purchasable: false`
 * (a preserved legacy amount) renders `قیمت نامشخص` through `Price` and gets a
 * disabled add-to-cart button plus an "unavailable" badge from `ProductCard`.
 * Nothing on this page multiplies, truncates or relabels an amount.
 */
export const dynamic = 'force-dynamic';

const PER_PAGE = 24;

type ProductsPageProps = {
  searchParams: Promise<{ page?: string }>;
};

export const metadata: Metadata = {
  title: 'محصولات | Toy Store',
  description: 'همه اسباب‌بازی‌های فروشگاه را با پیش‌نمایش سه‌بعدی ببینید و خریداری کنید.',
  alternates: { canonical: '/products' },
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const { page } = await searchParams;
  const pageNumber = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);

  let items: Product[] = [];
  let meta: Paginated<Product>['meta'] | null = null;
  let failed = false;

  try {
    const result = await getProducts({ page: pageNumber, per_page: PER_PAGE });

    items = result.items;
    meta = result.meta;
  } catch {
    // An unreachable or failing API is an infrastructure problem: say so
    // plainly instead of rendering an empty grid that looks like "no products".
    failed = true;
  }

  return (
    <Container className="py-8">
      <Breadcrumbs items={[{ label: 'محصولات' }]} />

      <h1 className="mt-4 font-display text-3xl text-ink">محصولات</h1>
      <p className="mt-2 text-sm text-ink/60">
        هر کارت را می‌توانید بچرخانید؛ محصولاتی که قیمت تومانی‌شان نهایی نشده
        است تا زمان تعیین قیمت قابل خرید نیستند.
      </p>

      {failed ? (
        <Card className="mt-8 p-8 text-center">
          <p role="alert" className="text-sm font-bold text-red-700">
            بارگذاری فهرست محصولات ناموفق بود. لطفاً دوباره تلاش کنید.
          </p>
          <Link
            href="/products"
            className="mt-4 inline-block rounded-md bg-brand-500 px-5 py-3 text-sm font-bold text-white shadow-card transition hover:bg-brand-600"
          >
            تلاش دوباره
          </Link>
        </Card>
      ) : items.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon="🧸"
            title="هنوز محصولی منتشر نشده است"
            description="به‌محض انتشار محصولات، همین‌جا نمایش داده می‌شوند."
            action={
              <Link
                href="/categories"
                className="rounded-md bg-brand-500 px-5 py-3 text-sm font-bold text-white shadow-card transition hover:bg-brand-600"
              >
                مشاهده دسته‌بندی‌ها
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} />
              </li>
            ))}
          </ul>

          <Pagination
            currentPage={meta?.current_page ?? 1}
            lastPage={meta?.last_page ?? 1}
            basePath="/products"
          />
        </>
      )}
    </Container>
  );
}
