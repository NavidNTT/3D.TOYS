import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ProductViewer3D from '@/src/components/3d/ProductViewer3D';
import ProductPurchasePanel from '@/src/components/products/ProductPurchasePanel';
import Badge from '@/src/components/ui/Badge';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import Card from '@/src/components/ui/Card';
import Container from '@/src/components/ui/Container';
import Price from '@/src/components/ui/Price';
import { resolveTheme } from '@/src/lib/theme';
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

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <ProductMedia
          product={product}
          poster={poster}
          accentColor={theme.primary}
        />

        <div className="space-y-6">
          {product.category && (
            <Badge color={theme.primary}>{product.category.name}</Badge>
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
            <p className="text-sm leading-7 text-ink/70">
              {product.description}
            </p>
          )}

          <ProductPurchasePanel product={product} />

          <Card className="space-y-3 p-5">
            <h2 className="font-display text-lg text-ink">مشخصات</h2>
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink/60">ابعاد</dt>
                <dd className="font-bold text-ink">
                  {size ?? 'ابعاد در توضیحات'}
                </dd>
              </div>
              {attributes.map(([key, value]) => (
                <div key={key} className="flex justify-between gap-4">
                  <dt className="text-ink/60">{key}</dt>
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
            className="inline-block text-sm font-bold text-brand-600 hover:underline"
          >
            مشاهده سایر دسته‌بندی‌ها
          </Link>
        </div>
      </div>
    </Container>
  );
}

/**
 * Viewer + image gallery column (right column in RTL flow).
 *
 * The 3D viewer is only rendered when the product actually has a model; the
 * image gallery shows whatever the API provides. `hotspots` are intentionally
 * not passed yet — no product carries spatial annotation data, and rendering
 * invented callouts would be worse than none.
 */
function ProductMedia({
  product,
  poster,
  accentColor,
}: {
  product: Product;
  poster: string | null;
  accentColor: string;
}) {
  const modelUrl = product.media_3d?.url ?? null;

  return (
    <div className="space-y-3">
      {modelUrl ? (
        <ProductViewer3D
          modelUrl={modelUrl}
          posterUrl={poster}
          alt={product.media_3d?.alt_text ?? product.title}
          accentColor={accentColor}
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

      {poster && modelUrl && (
        <div className="flex gap-2" aria-label="گالری تصاویر">
          <div className="relative h-20 w-20 overflow-hidden rounded-md border border-ink/15 bg-surface">
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

