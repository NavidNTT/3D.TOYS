import type { Metadata } from 'next';
import CategoryTile from '@/src/components/categories/CategoryTile';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import Container from '@/src/components/ui/Container';
import EmptyState from '@/src/components/ui/EmptyState';
import { formatNumberFa } from '@/src/lib/format';
import { getAllCategories } from '@/src/services/categoryService';
import { getProducts } from '@/src/services/productService';
import type { Product } from '@/src/types/product';

/**
 * Category showcase (`/categories`).
 *
 * Large tiles, one per category, each tinted by its own `theme_config`. The
 * hover preview needs a model, and categories carry no products of their own, so
 * one catalogue page is fetched and reduced to a single representative product
 * per category.
 *
 * The same fetch also yields a real product count per shelf — but only when it
 * saw the whole catalogue (`meta.total <= items.length`). A truncated page shows
 * no counts rather than wrong ones; the categories endpoint itself carries no
 * counts, and inventing them is worse than omitting them.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'دسته‌بندی‌ها | Toy Store',
  description:
    'همه دسته‌بندی‌های فروشگاه در یک نگاه؛ هر دسته با رنگ و پیش‌نمایش سه‌بعدی ویژه خود.',
};

export default async function CategoriesPage() {
  const [categories, { items, meta }] = await Promise.all([
    getAllCategories(),
    getProducts({ per_page: 60 }),
  ]);

  const previewByCategory = new Map<string, Product>();
  const countByCategory = new Map<string, number>();
  // Counts are only honest when this fetch saw every published product.
  const sawWholeCatalogue = meta === null || items.length >= meta.total;

  for (const product of items) {
    const slug = product.category?.slug;

    if (!slug) continue;

    if (product.media_3d?.url && !previewByCategory.has(slug)) {
      previewByCategory.set(slug, product);
    }

    if (sawWholeCatalogue) {
      countByCategory.set(slug, (countByCategory.get(slug) ?? 0) + 1);
    }
  }

  return (
    <Container className="py-8">
      <Breadcrumbs items={[{ label: 'دسته‌بندی‌ها' }]} />

      {/* INTRO — same warm panel language as the catalog hero */}
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
              PICK YOUR SHELF
            </p>
            <h1 className="mt-3 font-display text-3xl leading-tight text-ink sm:text-4xl">
              دسته‌بندی‌ها
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-graphite-700">
              هر قفسه رنگ و حال‌وهوای خودش را دارد؛ یکی را انتخاب کن تا
              محصولاتش را یک‌جا ببینی.
            </p>
          </div>

          <span className="tnum w-fit shrink-0 self-start rounded-full bg-toy-lime px-4 py-2 text-sm font-black text-graphite-900 sm:self-end">
            {formatNumberFa(categories.length)} دسته‌بندی
          </span>
        </div>
      </section>

      {categories.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon="🗂️"
            title="هنوز دسته‌بندی‌ای ثبت نشده است"
            description="پس از افزودن دسته‌بندی از پنل مدیریت، اینجا نمایش داده می‌شود."
          />
        </div>
      ) : (
        <>
          <h2 className="mt-8 font-display text-xl text-ink sm:text-2xl">
            قفسه‌ها
          </h2>

          <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => {
              const preview = previewByCategory.get(category.slug);
              const count = countByCategory.get(category.slug);

              return (
                <li key={category.id} className="relative">
                  <CategoryTile
                    category={category}
                    posterUrl={preview?.media_3d?.thumbnail_url ?? null}
                  />

                  {/* Real count, overlaid on the tile the route already owned;
                      `pointer-events-none` keeps the tile link the only hit
                      target. Omitted entirely when the fetch was truncated. */}
                  {sawWholeCatalogue && (
                    <span className="tnum pointer-events-none absolute start-4 top-4 rounded-full bg-surface/90 px-3 py-1 text-xs font-black text-graphite-900 shadow-card">
                      {formatNumberFa(count ?? 0)} محصول
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Container>
  );
}
