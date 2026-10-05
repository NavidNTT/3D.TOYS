import type { Metadata } from 'next';
import CategoryTile from '@/src/components/categories/CategoryTile';
import Container from '@/src/components/ui/Container';
import EmptyState from '@/src/components/ui/EmptyState';
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
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'دسته‌بندی‌ها | Toy Store',
  description:
    'همه دسته‌بندی‌های فروشگاه در یک نگاه؛ هر دسته با رنگ و پیش‌نمایش سه‌بعدی ویژه خود.',
};

export default async function CategoriesPage() {
  const [categories, { items }] = await Promise.all([
    getAllCategories(),
    getProducts({ per_page: 60 }),
  ]);

  const previewByCategory = new Map<string, Product>();

  for (const product of items) {
    const slug = product.category?.slug;

    if (slug && product.media_3d?.url && !previewByCategory.has(slug)) {
      previewByCategory.set(slug, product);
    }
  }

  return (
    <Container className="py-10">
      <h1 className="font-display text-3xl text-ink">دسته‌بندی‌ها</h1>
      <p className="mt-2 text-sm text-ink/60">
        یک دسته را انتخاب کنید تا محصولات آن را ببینید.
      </p>

      {categories.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon="🗂️"
            title="هنوز دسته‌بندی‌ای ثبت نشده است"
            description="پس از افزودن دسته‌بندی از پنل مدیریت، اینجا نمایش داده می‌شود."
          />
        </div>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const preview = previewByCategory.get(category.slug);

            return (
              <li key={category.id}>
                <CategoryTile
                  category={category}
                  modelUrl={preview?.media_3d?.url ?? null}
                  posterUrl={preview?.media_3d?.thumbnail_url ?? null}
                />
              </li>
            );
          })}
        </ul>
      )}
    </Container>
  );
}
