import type { Metadata } from 'next';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import Container from '@/src/components/ui/Container';
import EmptyState from '@/src/components/ui/EmptyState';
import Pagination from '@/src/components/ui/Pagination';
import ProductCard from '@/src/components/products/ProductCard';
import { normalizeSearchTerm } from '@/src/lib/persian';
import { getProducts } from '@/src/services/productService';

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

  const { items, meta } =
    term === ''
      ? { items: [], meta: null }
      : await getProducts({
          search: term,
          page: pageNumber,
          per_page: PER_PAGE,
        });

  return (
    <Container className="py-8">
      <Breadcrumbs items={[{ label: 'جستجو' }]} />

      <h1 className="mt-4 font-display text-3xl text-ink">
        {term ? `نتایج جستجو برای «${term}»` : 'جستجو در محصولات'}
      </h1>

      {term === '' ? (
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
              <a
                href="/categories"
                className="rounded-md bg-brand-500 px-5 py-3 text-sm font-bold text-white shadow-card transition hover:bg-brand-600"
              >
                مشاهده دسته‌بندی‌ها
              </a>
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
