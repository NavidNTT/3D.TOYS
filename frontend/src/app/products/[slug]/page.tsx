import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProductViewer3D, {
  type CameraSettings,
} from '@/src/components/3d/ProductViewer3D';
import AddToCartButton from '@/src/components/products/AddToCartButton';
import { formatPriceFa } from '@/src/lib/format';
import { resolveTheme, withAlpha } from '@/src/lib/theme';
import { getProductBySlug } from '@/src/services/productService';
import {
  toAttributeEntries,
  type LightingPreset,
  type Media3DCameraSettings,
} from '@/src/types/product';

interface ProductPageProps {
  params: { slug: string };
}

/** Maps the API's snake_case framing onto the viewer's prop names. */
function toCameraSettings(
  settings?: Media3DCameraSettings | null,
): CameraSettings | undefined {
  if (!settings) return undefined;

  return {
    position: settings.position,
    fov: settings.fov,
    minDistance: settings.min_distance,
    maxDistance: settings.max_distance,
    autoRotateSpeed: settings.auto_rotate_speed,
  };
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const product = await getProductBySlug(params.slug);

  if (!product) {
    return { title: 'Product not found | Toy Store' };
  }

  const title = `${product.name} | Toy Store`;
  const description =
    product.description?.slice(0, 160) ??
    `${product.name} — spin it in 3D before you buy.`;

  return {
    title,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `/products/${product.slug}`,
      images: product.media_3d?.thumbnail_url
        ? [{ url: product.media_3d.thumbnail_url }]
        : undefined,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const product = await getProductBySlug(params.slug);

  if (!product) {
    notFound();
  }

  const theme = resolveTheme(product.category?.theme_config);
  const attributes = toAttributeEntries(product.attributes);
  const media = product.media_3d;
  const inStock = product.stock > 0;
  const wasPrice =
    typeof product.compare_at_price === 'number' &&
    product.compare_at_price > product.price
      ? product.compare_at_price
      : null;

  return (
    <main className="relative mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12 lg:flex-row">
      {/* Ambient halo tinted with the category's glow_color. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px]"
        style={{
          background: `radial-gradient(60% 100% at 50% 0%, ${withAlpha(
            theme.glow,
            0.3,
          )}, transparent 70%)`,
        }}
      />

      <div className="w-full lg:w-1/2">
        {media ? (
          <div
            className="rounded-3xl"
            style={{ boxShadow: `0 0 90px -30px ${withAlpha(theme.glow, 0.95)}` }}
          >
            <ProductViewer3D
              modelUrl={media.url}
              themeColor={theme.background}
              lightingPreset={(media.lighting_preset ??
                'studio') as LightingPreset}
              cameraSettings={toCameraSettings(media.camera_settings)}
            />
          </div>
        ) : (
          <div className="flex aspect-square max-h-[500px] w-full items-center justify-center rounded-3xl border border-white/10 bg-white/5 px-6 text-center text-sm text-white/50">
            No 3D preview for this toy yet.
          </div>
        )}
        {media && (
          <p className="mt-3 text-center font-mono text-xs text-white/40">
            Drag to rotate · Scroll / pinch to zoom
          </p>
        )}
      </div>

      <section className="flex w-full flex-col gap-6 lg:w-1/2">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {product.category && (
              <span
                className="rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest"
                style={{
                  backgroundColor: withAlpha(theme.primary, 0.15),
                  borderColor: withAlpha(theme.primary, 0.4),
                  color: theme.primary,
                }}
              >
                {product.category.name}
              </span>
            )}
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                inStock
                  ? 'bg-emerald-400/15 text-emerald-300'
                  : 'bg-brick-500/20 text-brick-400'
              }`}
            >
              {inStock ? `In stock · ${product.stock}` : 'Out of stock'}
            </span>
          </div>

          <h1 className="text-3xl font-black leading-tight sm:text-4xl">
            {product.name}
          </h1>

          <p className="flex items-baseline gap-3">
            <span
              className="text-2xl font-bold"
              style={{ color: theme.primary }}
            >
              {formatPriceFa(product.price, product.currency)}
            </span>
            {wasPrice !== null && (
              <span className="text-sm text-white/40 line-through">
                {formatPriceFa(wasPrice, product.currency)}
              </span>
            )}
          </p>
        </div>

        {product.description && (
          <p className="text-base text-white/70">{product.description}</p>
        )}

        {attributes.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/50">
              Specifications
            </h2>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              {attributes.map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border bg-white/5 p-4"
                  style={{ borderColor: withAlpha(theme.glow, 0.25) }}
                >
                  <dt className="text-xs uppercase tracking-widest text-white/50">
                    {label}
                  </dt>
                  <dd className="mt-1 text-sm font-semibold">
                    {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className="flex gap-3">
          <AddToCartButton
            product={product}
            primaryColor={theme.primary}
            glowColor={theme.glow}
            disabled={!inStock}
          />
          <button
            type="button"
            className="rounded-xl border bg-white/5 px-4 py-3 font-bold text-white/80 transition hover:bg-white/10"
            style={{
              borderColor: withAlpha(theme.accent, 0.5),
              color: theme.accent,
            }}
          >
            Wishlist
          </button>
        </div>
      </section>
    </main>
  );
}
