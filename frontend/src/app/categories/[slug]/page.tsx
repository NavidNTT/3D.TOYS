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
import type { Category } from '@/src/types/product';

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

  // The API serialises `description` (see backend CategoryResource) but the
  // shared Category type predates that field; read it locally instead of
  // widening the contract file for a single consumer.
  const description =
    (category as Category & { description?: string | null }).description?.trim() ||
    null;

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

        {/* THEMED HEADER — the category's own `theme_config` keeps the shelf
            identity; the layout mirrors the catalog hero. Glows are built from
            the category's glow/accent so no two shelves look alike. */}
        <header
          className="relative isolate mt-6 overflow-hidden rounded-[2rem] border px-5 py-8 sm:rounded-[2.5rem] sm:px-8 sm:py-10"
          style={{
            borderColor: `${theme.primary}33`,
            backgroundColor: `${theme.primary}14`,
          }}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -left-12 -top-12 -z-10 h-48 w-48 rounded-full blur-3xl"
            style={{ backgroundColor: `${theme.glow}40` }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-16 right-1/4 -z-10 h-40 w-40 rounded-full blur-3xl"
            style={{ backgroundColor: `${theme.accent}66` }}
          />

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black tracking-[0.2em] text-graphite-600">
                {category.slug.toUpperCase()}
              </p>
              <h1
                className="mt-3 font-display text-3xl leading-tight sm:text-4xl"
                style={{ color: theme.primary }}
              >
                {category.name}
              </h1>
              {description && (
                <p className="mt-3 max-w-xl text-sm leading-7 text-graphite-700">
                  {description}
                </p>
              )}
            </div>

            {meta && (
              <span
                className="tnum w-fit shrink-0 self-start rounded-full border bg-surface px-4 py-2 text-sm font-black text-graphite-900 sm:self-end"
                style={{ borderColor: `${theme.primary}40` }}
              >
                <span
                  aria-hidden="true"
                  className="me-2 inline-block h-2 w-2 rounded-full align-middle"
                  style={{ backgroundColor: theme.primary }}
                />
                {formatNumberFa(meta.total)} محصول
              </span>
            )}
          </div>
        </header>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={filterHref}
            aria-pressed={inStockOnly}
            className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-bold transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
              inStockOnly
                ? 'border-transparent text-white'
                : 'border-ink/15 bg-surface text-ink/70 hover:bg-cream-100'
            }`}
            style={inStockOnly ? { backgroundColor: theme.primary } : undefined}
          >
            {inStockOnly && (
              <span aria-hidden="true" className="font-black">
                ✓
              </span>
            )}
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
