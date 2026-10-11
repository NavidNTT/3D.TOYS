import type { Metadata } from 'next';
import Link from 'next/link';
import CategoryStrip from '@/src/components/home/CategoryStrip';
import ProductCard from '@/src/components/products/ProductCard';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import Card from '@/src/components/ui/Card';
import Container from '@/src/components/ui/Container';
import EmptyState from '@/src/components/ui/EmptyState';
import Pagination from '@/src/components/ui/Pagination';
import { formatNumberFa } from '@/src/lib/format';
import { getAllCategories } from '@/src/services/categoryService';
import { getProducts } from '@/src/services/productService';
import type { Category, Paginated, Product } from '@/src/types/product';

/**
 * Public catalog listing (`/products`) — the whole storefront in one place.
 *
 * Every published product is listed, not a curated selection: the six preserved
 * legacy rows *and* the eight MinIO-backed 3D products, because a product that
 * only its direct URL can reach is not really published. Categories are the
 * other half of the same promise, so the chip row is fetched from the same
 * endpoint the category pages use rather than being hardcoded here; a category
 * that gains a product appears in both places at once.
 *
 * The money contract is enforced by the shared components rather than here: a
 * row whose API payload is `price: null, currency: 'USD', purchasable: false`
 * (a preserved legacy amount) renders `قیمت نامشخص` through `Price` and gets a
 * disabled add-to-cart button plus a "price under review" badge from
 * `ProductCard`. Nothing on this page multiplies, truncates or relabels an
 * amount.
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

/** The listing, or an explicit failure — never an empty grid that reads as "none". */
type Listing = {
  items: Product[];
  meta: Paginated<Product>['meta'] | null;
  failed: boolean;
};

async function loadListing(page: number): Promise<Listing> {
  try {
    const { items, meta } = await getProducts({ page, per_page: PER_PAGE });

    return { items, meta, failed: false };
  } catch {
    // An unreachable or failing API is an infrastructure problem: say so
    // plainly instead of rendering an empty grid that looks like "no products".
    return { items: [], meta: null, failed: true };
  }
}

/**
 * The category chips, best effort.
 *
 * A category list that fails must not take the catalog down with it: the
 * products are the page, the chips are a shortcut to the same rows grouped by
 * shelf. The API also caches this list for 30s, so the cost is one call.
 */
async function loadCategories(): Promise<Category[]> {
  try {
    return await getAllCategories();
  } catch {
    return [];
  }
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const { page } = await searchParams;
  const pageNumber = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);

  const [categories, listing] = await Promise.all([
    loadCategories(),
    loadListing(pageNumber),
  ]);

  const { items, meta, failed } = listing;

  return (
    <Container className="py-8">
      <Breadcrumbs items={[{ label: 'محصولات' }]} />

      <h1 className="mt-4 font-display text-3xl text-ink">محصولات</h1>
      <p className="mt-2 text-sm text-ink/60">
        هر کارت را می‌توانید بچرخانید؛ محصولاتی که قیمت تومانی‌شان نهایی نشده
        است تا زمان تعیین قیمت قابل خرید نیستند.
      </p>
      {meta && (
        <p className="tnum mt-1 text-sm text-ink/60">
          {formatNumberFa(meta.total)} محصول
        </p>
      )}

      {!failed && categories.length > 0 && (
        <nav aria-label="دسته‌بندی‌ها" className="mt-6">
          <CategoryStrip categories={categories} />
        </nav>
      )}

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
