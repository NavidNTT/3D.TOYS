import type { Metadata } from 'next';
import Link from 'next/link';
import CategoryStrip from '@/src/components/home/CategoryStrip';
import FeaturedModelHero from '@/src/components/home/FeaturedModelHero';
import ProductCard from '@/src/components/products/ProductCard';
import Container from '@/src/components/ui/Container';
import EmptyState from '@/src/components/ui/EmptyState';
import Section from '@/src/components/ui/Section';
import { resolveTheme } from '@/src/lib/theme';
import { getAllCategories } from '@/src/services/categoryService';
import { getProducts } from '@/src/services/productService';

/**
 * Home page.
 *
 * Server component: categories and featured products are fetched concurrently.
 * `force-dynamic` because the catalog API is unreachable during the Docker
 * image build and prices/stock must not be baked into a full-page cache; the
 * underlying fetches still cache for 30s at the data layer.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Toy Store — فروشگاه اسباب‌بازی با نمای سه‌بعدی',
  description:
    'هر اسباب‌بازی را پیش از خرید بچرخانید و از نزدیک ببینید. خرید آنلاین با ارسال سریع و امکان بازگشت کالا.',
};

const TRUST_ITEMS = [
  {
    icon: '↩️',
    title: 'بازگشت کالا',
    body: 'تا ۷ روز پس از دریافت، در صورت سالم بودن بسته‌بندی امکان بازگشت کالا وجود دارد.',
  },
  {
    icon: '🚚',
    title: 'ارسال سریع',
    body: 'ارسال به سراسر کشور؛ سفارش‌ها در کوتاه‌ترین زمان بسته‌بندی و ارسال می‌شوند.',
  },
  {
    icon: '🧸',
    title: 'اسباب‌بازی اصیل',
    body: 'همه محصولات دارای تأییدیه سلامت و ایمنی هستند و از فروشندگان معتبر تأمین می‌شوند.',
  },
];

export default async function HomePage() {
  const [categories, { items: products }] = await Promise.all([
    getAllCategories(),
    getProducts({ per_page: 8, in_stock: true }),
  ]);

  const featured = products.find((product) => product.media_3d?.url) ?? products[0] ?? null;
  const featuredTheme = resolveTheme(featured?.category?.theme_config);

  return (
    <Container className="space-y-4 py-10">
      <section className="grid items-center gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <span
            className="inline-block rounded-full px-3 py-1 text-xs font-bold"
            style={{
              color: featuredTheme.primary,
              backgroundColor: `${featuredTheme.primary}14`,
            }}
          >
            پیش‌نمایش سه‌بعدی پیش از خرید
          </span>

          <h1 className="font-display text-4xl leading-tight text-ink sm:text-5xl">
            اسباب‌بازی را بچرخان،
            <span className="block" style={{ color: featuredTheme.primary }}>
              بعد بخر.
            </span>
          </h1>

          <p className="max-w-lg text-base leading-8 text-ink/70">
            هر محصول یک مدل سه‌بعدی واقعی دارد؛ آن را از هر زاویه ببینید و با
            خیال راحت انتخاب کنید.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/categories"
              className="rounded-md bg-brand-500 px-5 py-3 text-sm font-bold text-white shadow-card transition hover:bg-brand-600"
            >
              مشاهده دسته‌بندی‌ها
            </Link>
            {featured && (
              <Link
                href={`/products/${featured.slug}`}
                className="rounded-md border border-ink/15 bg-surface px-5 py-3 text-sm font-bold text-ink/80 transition hover:bg-cream-100"
              >
                دیدن محصول ویژه
              </Link>
            )}
          </div>
        </div>

        <FeaturedModelHero
          modelUrl={featured?.media_3d?.url ?? null}
          posterUrl={featured?.media_3d?.thumbnail_url ?? null}
          alt={featured?.title ?? 'مدل سه‌بعدی اسباب‌بازی'}
          accentColor={featuredTheme.glow}
        />
      </section>

      <Section labelledBy="categories-heading">
        <h2
          id="categories-heading"
          className="mb-4 font-display text-2xl text-ink"
        >
          دسته‌بندی‌ها
        </h2>
        <CategoryStrip categories={categories} />
      </Section>

      <Section labelledBy="featured-heading">
        <h2 id="featured-heading" className="mb-4 font-display text-2xl text-ink">
          محصولات ویژه
        </h2>
        {products.length === 0 ? (
          <EmptyState
            icon="🧸"
            title="هنوز محصولی منتشر نشده است"
            description="به‌زودی اسباب‌بازی‌های جدید اضافه می‌شوند."
          />
        ) : (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section labelledBy="trust-heading">
        <h2 id="trust-heading" className="mb-4 font-display text-2xl text-ink">
          چرا Toy Store؟
        </h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {TRUST_ITEMS.map((item) => (
            <li
              key={item.title}
              className="rounded-lg bg-surface p-5 shadow-card"
            >
              <span aria-hidden className="text-2xl">
                {item.icon}
              </span>
              <h3 className="mt-2 font-display text-lg text-ink">
                {item.title}
              </h3>
              <p className="mt-1 text-sm leading-6 text-ink/60">{item.body}</p>
            </li>
          ))}
        </ul>
      </Section>
    </Container>
  );
}
