import Image from 'next/image';
import Link from 'next/link';
import { formatPriceFa } from '@/src/lib/format';
import { resolveTheme, withAlpha } from '@/src/lib/theme';
import type { Product } from '@/src/types/product';

interface ProductCardProps {
  product: Product;
}

/**
 * Storefront grid tile.
 *
 * Server component: everything here is a link or CSS, so the card ships no
 * client JavaScript. Colours come from the product's category `theme_config`,
 * while the price is rendered in fa-IR (see src/lib/format.ts).
 */
export default function ProductCard({ product }: ProductCardProps) {
  const theme = resolveTheme(product.category?.theme_config);
  const thumbnail = product.media_3d?.thumbnail_url ?? null;
  const inStock = product.stock > 0;
  const wasPrice =
    typeof product.compare_at_price === 'number' &&
    product.compare_at_price > product.price
      ? product.compare_at_price
      : null;

  return (
    <Link
      href={`/products/${product.slug}`}
      aria-label={`View ${product.name}`}
      className="group flex flex-col overflow-hidden rounded-3xl border bg-white/5 shadow-block transition duration-300 hover:-translate-y-1 hover:bg-white/10"
      style={{ borderColor: withAlpha(theme.glow, 0.25) }}
    >
      <div
        className="relative aspect-square w-full overflow-hidden"
        style={{
          background: `radial-gradient(70% 70% at 50% 30%, ${withAlpha(
            theme.glow,
            0.28,
          )}, ${theme.background})`,
        }}
      >
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt={product.media_3d?.alt_text ?? product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          // No thumbnail uploaded yet: keep the tile on-brand instead of
          // showing a broken image.
          <div className="flex h-full w-full items-center justify-center">
            <span
              className="font-mono text-4xl font-black tracking-widest"
              style={{ color: withAlpha(theme.primary, 0.55) }}
            >
              3D
            </span>
          </div>
        )}

        {product.category && (
          <span
            className="absolute start-3 top-3 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest backdrop-blur"
            style={{
              backgroundColor: withAlpha(theme.primary, 0.22),
              borderColor: withAlpha(theme.primary, 0.45),
              color: theme.primary,
            }}
          >
            {product.category.name}
          </span>
        )}

        {!inStock && (
          <span className="absolute end-3 top-3 rounded-full bg-brick-500/90 px-3 py-1 text-xs font-bold text-white">
            Sold out
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="line-clamp-2 text-base font-bold leading-snug">
          {product.name}
        </h3>

        <p className="mt-auto flex items-baseline gap-2">
          <span
            className="text-lg font-black"
            style={{ color: theme.primary }}
          >
            {formatPriceFa(product.price, product.currency)}
          </span>
          {wasPrice !== null && (
            <span className="text-xs text-white/40 line-through">
              {formatPriceFa(wasPrice, product.currency)}
            </span>
          )}
        </p>

        {/*
          The whole card is the link, so this is a styled span rather than a
          nested <button> — interactive elements inside an anchor are invalid
          HTML and break keyboard navigation.
        */}
        <span
          className="inline-flex w-full items-center justify-center rounded-xl px-4 py-2 text-sm font-bold text-white transition group-hover:brightness-110"
          style={{
            backgroundColor: theme.primary,
            boxShadow: `0 10px 24px -14px ${withAlpha(theme.glow, 0.95)}`,
          }}
        >
          View in 3D
        </span>
      </div>
    </Link>
  );
}
