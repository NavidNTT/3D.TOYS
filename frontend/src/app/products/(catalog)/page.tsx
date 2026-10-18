import type { Metadata } from 'next';
import Link from 'next/link';
import CategoryStrip from '@/src/components/home/CategoryStrip';
import ProductCard from '@/src/components/products/ProductCard';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import Card from '@/src/components/ui/Card';
import Container from '@/src/components/ui/Container';
import EmptyState from '@/src/components/ui/EmptyState';
import Input from '@/src/components/ui/Input';
import Pagination from '@/src/components/ui/Pagination';
import { formatNumberFa } from '@/src/lib/format';
import { normalizeSearchTerm } from '@/src/lib/persian';
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
 * The query-string contract is limited to what GET /api/v1/products actually
 * validates (ProductIndexRequest): `page`, `search` and `in_stock`. There is no
 * sort parameter on the API, so no sort control is offered here. `search` is
 * normalised with the same helper `/search` uses, and Pagination carries both
 * filters across pages via its `params` prop, so a filtered view stays filtered
 * when the visitor moves between result pages.
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
  searchParams: Promise<{ page?: string; search?: string; in_stock?: string }>;
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

async function loadListing(
  page: number,
  search: string,
  inStockOnly: boolean,
): Promise<Listing> {
  try {
    const { items, meta } = await getProducts({
      page,
      per_page: PER_PAGE,
      ...(search ? { search } : {}),
      ...(inStockOnly ? { in_stock: true } : {}),
    });

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
  const { page, search, in_stock } = await searchParams;
  const pageNumber = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
  // Same normalisation as `/search`, capped where ProductIndexRequest caps it.
  // The typeof guard keeps an array-valued `?search=` from crashing the page.
  const term =
    typeof search === 'string' ? normalizeSearchTerm(search).slice(0, 100) : '';
  const inStockOnly = in_stock === '1' || in_stock === 'true';
  const hasFilter = term !== '' || inStockOnly;

  const [categories, listing] = await Promise.all([
    loadCategories(),
    loadListing(pageNumber, term, inStockOnly),
  ]);

  const { items, meta, failed } = listing;

  // Current filters without the page number: what "retry" and the filtered
  // empty state should link to. The stock toggle adds/removes only its own key.
  const catalogParams = new URLSearchParams();
  if (term) catalogParams.set('search', term);
  if (inStockOnly) catalogParams.set('in_stock', '1');
  const catalogQuery = catalogParams.toString();
  const catalogHref = catalogQuery ? `/products?${catalogQuery}` : '/products';

  const stockToggleParams = new URLSearchParams(catalogQuery);
  if (!inStockOnly) stockToggleParams.set('in_stock', '1');
  const stockToggleQuery = stockToggleParams.toString();
  const stockToggleHref = stockToggleQuery
    ? `/products?${stockToggleQuery}`
    : '/products';

  const pillAction =
    'inline-block rounded-full bg-brand-500 px-6 py-3 text-sm font-bold text-white shadow-card transition hover:-translate-y-0.5 hover:bg-brand-600 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';

  return (
    <Container className="py-8">
      <Breadcrumbs items={[{ label: 'محصولات' }]} />

      {/* INTRO — the homepage hero's warm panel language, kept quiet so the
          grid below stays the protagonist. */}
      <section className="relative isolate mt-4 overflow-hidden rounded-[2rem] bg-cream-100 px-5 py-8 sm:rounded-[2.5rem] sm:px-8 sm:py-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-16 -top-16 -z-10 h-56 w-56 rounded-full bg-toy-lime/40 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 right-1/4 -z-10 h-52 w-52 rounded-full bg-brand-500/10 blur-3xl"
        />

        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black tracking-[0.2em] text-brand-500">
              EVERY TOY, ONE SHELF
            </p>
            <h1 className="mt-3 font-display text-3xl leading-tight text-ink sm:text-4xl">
              محصولات
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-graphite-700">
              کل قفسه‌ی فروشگاه همین‌جاست؛ مدل سه‌بعدی هر اسباب‌بازی در صفحه‌ی
              خودش منتظرته.
            </p>
            <p className="mt-2 flex items-start gap-1.5 text-xs leading-6 text-graphite-600">
              <span aria-hidden="true" className="font-black text-toy-orange-deep">
                ✳
              </span>
              <span>
                محصولاتی که قیمت تومانی‌شان نهایی نشده، تا زمان تعیین قیمت قابل
                خرید نیستند.
              </span>
            </p>
          </div>

          {meta && (
            <span className="tnum w-fit shrink-0 self-start rounded-full bg-toy-lime px-4 py-2 text-sm font-black text-graphite-900 sm:self-end">
              {formatNumberFa(meta.total)} محصول
            </span>
          )}
        </div>
      </section>

      {/* SEARCH / FILTER — server-rendered only: the form GETs the same query
          string the page reads, and the stock chip is a real link toggle, so
          neither control needs client JavaScript. */}
      <Card className="mt-6 p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <form
            role="search"
            method="get"
            action="/products"
            aria-label="جستجو در محصولات"
            className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Input
              id="catalog-search"
              type="search"
              name="search"
              defaultValue={term}
              placeholder="جستجو در نام اسباب‌بازی‌ها…"
              aria-label="جستجو در محصولات"
              className="w-full sm:flex-1"
            />
            {/* Keeps the active stock filter when only the term is submitted. */}
            {inStockOnly && <input type="hidden" name="in_stock" value="1" />}
            <button
              type="submit"
              className="shrink-0 rounded-full bg-brand-500 px-6 py-3 text-sm font-bold text-white shadow-card transition hover:-translate-y-0.5 hover:bg-brand-600 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 sm:py-2.5"
            >
              جستجو
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={stockToggleHref}
              aria-label={
                inStockOnly
                  ? 'نمایش همه محصولات، شامل ناموجود‌ها'
                  : 'فقط محصولات موجود انبار را نشان بده'
              }
              className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-bold transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
                inStockOnly
                  ? 'border-brand-500 bg-brand-50 text-brand-600 hover:bg-brand-100'
                  : 'border-ink/15 bg-cream-50 text-ink/70 hover:bg-cream-100'
              }`}
            >
              {inStockOnly && (
                <span aria-hidden="true" className="font-black">
                  ✓
                </span>
              )}
              فقط موجود انبار
            </Link>

            {hasFilter && (
              <Link
                href="/products"
                className="rounded-full px-3 py-2 text-xs font-bold text-graphite-600 underline-offset-4 transition hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                پاک کردن فیلترها
              </Link>
            )}
          </div>
        </div>
      </Card>

      {/* CATEGORY CHIPS — navigation to the category pages, not filters of
          this list; same condition and endpoint as before. */}
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
          <Link href={catalogHref} className={`${pillAction} mt-4`}>
            تلاش دوباره
          </Link>
        </Card>
      ) : items.length === 0 && hasFilter ? (
        <div className="mt-8">
          <EmptyState
            icon="🔍"
            title="چیزی با این فیلترها پیدا نشد"
            description="عبارت دیگری امتحان کنید یا فیلترها را پاک کنید تا همه محصولات را ببینید."
            action={
              <Link href="/products" className={pillAction}>
                پاک کردن فیلترها
              </Link>
            }
          />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon="🧸"
            title="هنوز محصولی منتشر نشده است"
            description="به‌محض انتشار محصولات، همین‌جا نمایش داده می‌شوند."
            action={
              <Link href="/categories" className={pillAction}>
                مشاهده دسته‌بندی‌ها
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
            params={{
              search: term || undefined,
              in_stock: inStockOnly ? '1' : undefined,
            }}
          />
        </>
      )}
    </Container>
  );
}
