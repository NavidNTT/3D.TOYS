import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import Card from '@/src/components/ui/Card';
import Container from '@/src/components/ui/Container';
import EmptyState from '@/src/components/ui/EmptyState';
import Input from '@/src/components/ui/Input';
import Pagination from '@/src/components/ui/Pagination';
import ProductCard from '@/src/components/products/ProductCard';
import { formatNumberFa } from '@/src/lib/format';
import { normalizeSearchTerm } from '@/src/lib/persian';
import { getProducts } from '@/src/services/productService';
import type { Paginated, Product } from '@/src/types/product';

/**
 * Full search results (`/search?q=…`).
 *
 * The term is normalised identically to the backend's `PersianText::normalize`
 * before it is sent, so «كتاب» and «کتاب» are the same query on either side.
 * Rendered per request for the same reasons as the category grid: a result set
 * must reflect live stock, and the API is unreachable during the image build.
 */
export const dynamic = 'force-dynamic';

const PER_PAGE = 24;

/** The listing, or an explicit failure — never an empty grid that reads as "none". */
type Listing = {
  items: Product[];
  meta: Paginated<Product>['meta'] | null;
  failed: boolean;
};

async function loadListing(term: string, page: number): Promise<Listing> {
  try {
    const { items, meta } = await getProducts({
      search: term,
      page,
      per_page: PER_PAGE,
    });

    return { items, meta, failed: false };
  } catch {
    // An unreachable or failing API is an infrastructure problem: say so
    // plainly instead of rendering an empty grid that looks like "no results".
    return { items: [], meta: null, failed: true };
  }
}

type SearchPageProps = {
  searchParams: Promise<{ q?: string; page?: string }>;
};

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const { q = '' } = await searchParams;
  const term = normalizeSearchTerm(q).slice(0, 100);

  return {
    title: term ? `جستجو: ${term} | Toy Store` : 'جستجو | Toy Store',
    description: 'نتایج جستجوی محصولات فروشگاه Toy Store.',
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = '', page } = await searchParams;
  const term = normalizeSearchTerm(q).slice(0, 100);
  const pageNumber = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);

  const { items, meta, failed } =
    term === ''
      ? { items: [], meta: null, failed: false }
      : await loadListing(term, pageNumber);

  return (
    <Container className="py-8">
      <Breadcrumbs items={[{ label: 'جستجو' }]} />

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
              SEARCH
            </p>
            <h1 className="mt-3 font-display text-3xl leading-tight text-ink sm:text-4xl">
              {term ? `نتایج جستجو برای «${term}»` : 'جستجو در محصولات'}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-graphite-700">
              {term
                ? 'نتایج بر اساس نام و مشخصات اسباب‌بازی‌ها مرتب شده‌اند.'
                : 'نام اسباب‌بازی موردنظرت را بنویس؛ می‌توانی روی نام هر کارت هم کلیک کنی.'}
            </p>
          </div>

          {!failed && term !== '' && meta && (
            <span className="tnum w-fit shrink-0 self-start rounded-full bg-toy-lime px-4 py-2 text-sm font-black text-graphite-900 sm:self-end">
              {formatNumberFa(meta.total)} محصول
            </span>
          )}
        </div>
      </section>

      {/* SEARCH — a plain GET form, so the query string is the whole state and
          the results stay shareable. It writes the same `q` the page reads. */}
      <Card className="mt-6 p-3 sm:p-4">
        <form
          role="search"
          method="get"
          action="/search"
          aria-label="جستجو در محصولات"
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <Input
            id="search-query"
            type="search"
            name="q"
            defaultValue={term}
            placeholder="نام اسباب‌بازی…"
            aria-label="عبارت جستجو"
            className="w-full sm:flex-1"
          />
          <button
            type="submit"
            className="shrink-0 rounded-full bg-brand-500 px-6 py-3 text-sm font-bold text-white shadow-card transition hover:-translate-y-0.5 hover:bg-brand-600 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 sm:py-2.5"
          >
            جستجو
          </button>
        </form>

        {term !== '' && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500 bg-brand-50 px-4 py-2 text-sm font-bold text-brand-600">
              <span aria-hidden="true" className="font-black">
                ✓
              </span>
              عبارت فعال: «{term}»
            </span>
            <Link
              href="/search"
              className="rounded-full px-3 py-2 text-xs font-bold text-graphite-600 underline-offset-4 transition hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              پاک کردن جستجو
            </Link>
          </div>
        )}
      </Card>

      {failed ? (
        <Card className="mt-8 p-8 text-center">
          <p role="alert" className="text-sm font-bold text-red-700">
            بارگذاری نتایج جستجو ناموفق بود. لطفاً دوباره تلاش کنید.
          </p>
          <Link
            href={`/search?q=${encodeURIComponent(term)}`}
            className="mt-4 inline-block rounded-full bg-brand-500 px-6 py-3 text-sm font-bold text-white shadow-card transition hover:-translate-y-0.5 hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            تلاش دوباره
          </Link>
        </Card>
      ) : term === '' ? (
        <div className="mt-8">
          <EmptyState
            icon="🔍"
            title="عبارت جستجو را وارد کنید"
            description="می‌توانید نام اسباب‌بازی را بنویسید؛ نتایج به‌صورت زنده نمایش داده می‌شوند."
          />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon="🤔"
            title="محصولی با این عبارت پیدا نشد"
            description="امتحان کنید: املای دیگر واژه، یا یکی از دسته‌بندی‌ها."
            action={
              <Link
                href="/categories"
                className="rounded-full bg-brand-500 px-6 py-3 text-sm font-bold text-white shadow-card transition hover:-translate-y-0.5 hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
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
            basePath="/search"
            params={{ q: term }}
          />
        </>
      )}
    </Container>
  );
}
