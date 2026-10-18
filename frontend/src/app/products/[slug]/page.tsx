import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ProductViewer3D from '@/src/components/3d/ProductViewer3D';
import ProductPurchasePanel from '@/src/components/products/ProductPurchasePanel';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import Card from '@/src/components/ui/Card';
import Container from '@/src/components/ui/Container';
import Price from '@/src/components/ui/Price';
import { resolveTheme, type ResolvedTheme } from '@/src/lib/theme';
import { getProductBySlug } from '@/src/services/productService';
import {
  toAttributeEntries,
  type Product,
  type ProductAttributeValue,
} from '@/src/types/product';

/**
 * Product detail page (RTL, light warm theme).
 *
 * Rendered per request (`force-dynamic`): stock and price must never be served
 * from a full-page cache, and the catalog API is unreachable while the Docker
 * image builds. Caching still happens one layer down — the product service
 * fetches with `revalidate: 30`, so Laravel is not hammered per visitor.
 *
 * Dynamic route params are a Promise in Next 16 and must be awaited.
 */
export const dynamic = 'force-dynamic';

type ProductPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return { title: 'محصول یافت نشد | Toy Store' };
  }

  const description =
    product.description?.slice(0, 160) ??
    `${product.title} — پیش‌نمایش سه‌بعدی و خرید آنلاین از Toy Store.`;
  const poster = product.media_3d?.thumbnail_url ?? null;

  return {
    title: `${product.title} | Toy Store`,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: product.title,
      description,
      type: 'website',
      locale: 'fa_IR',
      images: poster ? [{ url: poster, alt: product.title }] : undefined,
    },
  };
}

/**
 * Pulls the size hint out of the attributes when the owner supplied one.
 *
 * No invented numbers: with no size attribute the page says so and points at
 * the description instead of guessing a dimension.
 */
function findSizeAttribute(
  entries: Array<[string, ProductAttributeValue]>,
): string | null {
  const match = entries.find(([key]) =>
    /(ابعاد|اندازه|size|dimension)/i.test(key),
  );

  return match ? String(match[1]) : null;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const theme = resolveTheme(product.category?.theme_config);
  const poster = product.media_3d?.thumbnail_url ?? null;
  const attributes = toAttributeEntries(product.attributes);
  const size = findSizeAttribute(attributes);

  return (
    // Soft page tint from the product's own category, exactly as the category
    // listing does it — a visitor moving shelf → product keeps the same
    // ambience. Runtime theme_config colours are inline styles by contract
    // (Tailwind cannot compile API values).
    <div
      className="min-h-full transition-colors duration-500"
      style={{ backgroundColor: `${theme.primary}0a` }}
    >
      <Container className="py-8">
        <Breadcrumbs
          items={[
            ...(product.category
              ? [
                  {
                    label: product.category.name,
                    href: `/categories/${product.category.slug}`,
                  },
                ]
              : []),
            { label: product.title },
          ]}
        />

        {/* Two columns in RTL: the 3D stage sits on the reading-start side
            (right) and sticks while the details scroll; identity + purchase
            occupy the left track. On small screens the stage leads, then the
            information — the same order the desktop layout reads. */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
          {/* 3D STAGE (right column in RTL flow) */}
          <ProductMedia product={product} poster={poster} theme={theme} />

          {/* IDENTITY + PURCHASE */}
          <div className="space-y-4">
            {product.category && (
              <Link
                href={`/categories/${product.category.slug}`}
                className="inline-flex w-fit items-center gap-2 rounded-full border bg-surface px-4 py-1.5 text-xs font-bold transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                style={{
                  borderColor: `${theme.primary}40`,
                  color: theme.primary,
                }}
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: theme.primary }}
                />
                {product.category.name}
              </Link>
            )}

            <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">
              {product.title}
            </h1>

            <Price
              value={product.price}
              currency={product.currency}
              wasValue={product.compare_at_price ?? null}
              size="lg"
              accentColor={theme.primary}
            />

            {product.description && (
              <p className="text-sm leading-7 text-graphite-700">
                {product.description}
              </p>
            )}

            {/* PURCHASE — the panel owns every stock/quantity/cart rule; the
                card only gives the primary action its own surface so it never
                competes with supporting information. */}
            <Card className="p-5">
              <ProductPurchasePanel product={product} />
            </Card>

            <Card className="p-5">
              <h2 className="font-display text-lg text-ink">مشخصات</h2>
              <dl className="mt-3 divide-y divide-ink/5 text-sm">
                <div className="flex justify-between gap-4 py-2">
                  <dt className="text-graphite-600">ابعاد</dt>
                  <dd className="font-bold text-ink">
                    {size ?? 'ابعاد در توضیحات'}
                  </dd>
                </div>
                {attributes.map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-4 py-2">
                    <dt className="text-graphite-600">{key}</dt>
                    <dd className="font-bold text-ink">
                      {typeof value === 'boolean'
                        ? value
                          ? 'دارد'
                          : 'ندارد'
                        : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>

            <Link
              href="/categories"
              className="inline-flex w-fit items-center rounded-full border border-ink/15 bg-surface px-4 py-2 text-sm font-bold text-ink/70 shadow-card transition hover:-translate-y-0.5 hover:bg-cream-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              مشاهده سایر دسته‌بندی‌ها
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
}

/**
 * 3D stage + gallery column (right column in RTL flow).
 *
 * The stage card frames whichever media the product actually has: the WebGL
 * viewer when a model exists, the poster image when only that exists, and the
 * honest placeholder when neither does. The drag caption only renders under a
 * real model, so a product without one never claims 3D support. Glows borrow
 * the category's own colours (same pattern as the category listing) and sit
 * behind the opaque stage surface, so they never reduce model visibility.
 *
 * `hotspots` are intentionally not passed — no product carries spatial
 * annotation data, and rendering invented callouts would be worse than none.
 */
function ProductMedia({
  product,
  poster,
  theme,
}: {
  product: Product;
  poster: string | null;
  theme: ResolvedTheme;
}) {
  const modelUrl = product.media_3d?.url ?? null;

  return (
    <div className="space-y-3 lg:sticky lg:top-20">
      {/* STAGE — glows behind an opaque white card keep the model crisp. */}
      <div className="relative isolate overflow-hidden rounded-[2rem] bg-surface p-3 shadow-card ring-1 ring-ink/5 sm:p-4">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-10 right-1/4 -z-10 h-40 w-40 rounded-full blur-3xl"
          style={{ backgroundColor: `${theme.glow}40` }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-12 left-1/4 -z-10 h-32 w-32 rounded-full blur-3xl"
          style={{ backgroundColor: `${theme.accent}66` }}
        />

        {modelUrl ? (
          <ProductViewer3D
            modelUrl={modelUrl}
            posterUrl={poster}
            alt={product.media_3d?.alt_text ?? product.title}
            accentColor={theme.primary}
          />
        ) : poster ? (
          <div className="relative aspect-square overflow-hidden rounded-xl bg-cream-100">
            <Image
              src={poster}
              alt={product.title}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="grid aspect-square place-items-center rounded-xl bg-cream-100 text-sm text-ink/50">
            تصویری برای این محصول ثبت نشده است.
          </div>
        )}
      </div>

      {/* Honest caption: the drag affordance is only promised when a model
          actually exists; otherwise say plainly that there is none. */}
      <p className="text-center text-xs text-graphite-600">
        {modelUrl
          ? 'مدل سه‌بعدی را بکشید و بچرخانید؛ برای نماهای آماده از دکمه‌های پایین استفاده کنید.'
          : 'مدل سه‌بعدی برای این محصول ثبت نشده است.'}
      </p>

      {poster && modelUrl && (
        <div className="flex gap-2" aria-label="گالری تصاویر">
          <div className="relative h-20 w-20 overflow-hidden rounded-xl border border-ink/15 bg-surface">
            <Image
              src={poster}
              alt={`تصویر ${product.title}`}
              fill
              sizes="80px"
              className="object-cover"
            />
          </div>
        </div>
      )}
    </div>
  );
}

