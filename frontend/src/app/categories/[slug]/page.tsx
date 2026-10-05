import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ProductCard from '@/src/components/products/ProductCard';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import Container from '@/src/components/ui/Container';
import EmptyState from '@/src/components/ui/EmptyState';
import Pagination from '@/src/components/ui/Pagination';
import { formatNumberFa } from '@/src/lib/format';
import { resolveTheme } from '@/src/lib/theme';
import { getCategoryBySlug } from '@/src/services/categoryService';
import { getProducts } from '@/src/services/productService';

/**
 * Category listing (`/categories/[slug]`).
 *
 * Server-rendered grid with page-based pagination and a single "in stock only"
 * filter (the brief's only filter for now). The whole page picks up the
 * category's accent as a soft tint that transitions in, rather than a heavy
 * animation.
 */
export const dynamic = 'force-dynamic';

const PER_PAGE = 12;

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; in_stock?: string }>;
};

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);

  if (!category) {
    return { title: 'دسته‌بندی یافت نشد | Toy Store' };
  }

  return {
    title: `${category.name} | Toy Store`,
    description: `محصولات دسته «${category.name}» را با پیش‌نمایش سه‌بعدی ببینید و خریداری کنید.`,
    alternates: { canonical: `/categories/${category.slug}` },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { slug } = await params;
  const { page, in_stock } = await searchParams;

  const category = await getCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  const pageNumber = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
  const inStockOnly = in_stock === '1';
  const theme = resolveTheme(category.theme_config);

  const { items, meta } = await getProducts({
    category: category.slug,
    in_stock: inStockOnly,
    page: pageNumber,
    per_page: PER_PAGE,
  });

  const filterHref = inStockOnly
    ? `/categories/${category.slug}`
    : `/categories/${category.slug}?in_stock=1`;

  return (
    <div
      className="min-h-full transition-colors duration-500"
      style={{ backgroundColor: `${theme.primary}0a` }}
    >
      <Container className="py-8">
        <Breadcrumbs
          items={[
            { label: 'دسته‌بندی‌ها', href: '/categories' },
            { label: category.name },
          ]}
        />

        <header
          className="mt-6 rounded-xl border p-6"
          style={{
            borderColor: `${theme.primary}33`,
            backgroundColor: `${theme.primary}14`,
          }}
        >
          <h1 className="font-display text-3xl" style={{ color: theme.primary }}>
            {category.name}
          </h1>
          {meta && (
            <p className="tnum mt-1 text-sm text-ink/60">
              {formatNumberFa(meta.total)} محصول
            </p>
          )}
        </header>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={filterHref}
            aria-pressed={inStockOnly}
            className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
              inStockOnly
                ? 'border-transparent text-white'
                : 'border-ink/15 bg-surface text-ink/70 hover:bg-cream-100'
            }`}
            style={inStockOnly ? { backgroundColor: theme.primary } : undefined}
          >
            فقط کالاهای موجود
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              icon="📦"
              title="محصولی یافت نشد"
              description={
                inStockOnly
                  ? 'در حال حاضر کالای موجودی در این دسته وجود ندارد.'
                  : 'به‌زودی محصولات این دسته اضافه می‌شوند.'
              }
            />
          </div>
        ) : (
          <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        )}

        <Pagination
          currentPage={meta?.current_page ?? 1}
          lastPage={meta?.last_page ?? 1}
          basePath={`/categories/${category.slug}`}
          params={{ in_stock: inStockOnly ? '1' : undefined }}
        />
      </Container>
    </div>
  );
}
