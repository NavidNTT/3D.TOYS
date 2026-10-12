'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Badge from '@/src/components/ui/Badge';
import MediaPlaceholder from '@/src/components/ui/MediaPlaceholder';
import Price from '@/src/components/ui/Price';
import {
  categoryLabel,
  HAS_MODEL_BADGE_LABEL,
  has3DModel,
  productPath,
  VIEW_MODEL_LABEL,
} from '@/src/lib/catalog';
import { resolveTheme } from '@/src/lib/theme';
import { useCartStore } from '@/src/store/useCartStore';
import { isPurchasable, type Product } from '@/src/types/product';

/**
 * Catalog card, shared by the home rails, category grids and search results.
 *
 * **This card is deliberately 2D.** It used to mount a rotating WebGL preview of
 * the product on hover (`ModelPreview`, a react-three-fiber `<Canvas>`), and two
 * things went wrong with it:
 *
 *  1. The canvas is a live, self-sizing element — r3f writes its own
 *     `position: relative; width/height: 100%` onto its wrapper and observes the
 *     element with a ResizeObserver. Dropped into an `aspect-ratio` media box it
 *     fed its own measurement back in as layout, so hovering a card on Windows
 *     could grow the card's height without settling. The grid is a layout, not a
 *     viewer, and it must have a height that depends only on its own width.
 *  2. A listing should not pull megabytes of geometry (the cars are 17–21 MB)
 *     and boot a WebGL context just because a pointer crossed a tile.
 *
 * The 3D viewer now lives only on the product detail page, reached through the
 * explicit `مشاهده مدل سه‌بعدی` link below; the card advertises that a model
 * exists with a badge and never loads one. Nothing in this component's tree
 * imports a canvas, a loader, or a model URL.
 *
 * Discovery is explicit too. Every route on this card — poster, title and the
 * labelled model link — is built by src/lib/catalog.ts from the product slug, so
 * a card can only point at the route the API itself resolves. A product with no
 * category says so (`بدون دسته‌بندی`) instead of leaving a silent gap where every
 * other card has a badge, and a product with no picture gets a labelled neutral
 * placeholder rather than a stand-in image of some other toy.
 */
export default function ProductCard({ product }: { product: Product }) {
  const addItem = useCartStore((state) => state.addItem);
  const theme = resolveTheme(product.category?.theme_config);

  const poster = product.media_3d?.thumbnail_url ?? null;
  const hasModel = has3DModel(product);
  const inStock = product.stock > 0;
  // Distinct from `inStock`: the row exists and may be in stock, but has no
  // toman amount yet, so it cannot be sold at any price.
  const purchasable = isPurchasable(product);

  const [added, setAdded] = useState(false);

  const quickAdd = () => {
    // `addItem` refuses a product with no toman amount, so only claim success
    // when the line really went into the cart.
    setAdded(addItem(product, 1));
  };

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-lg bg-surface shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-pop">
      {/* Height is owned by this box alone: it is exactly as tall as it is wide,
          it clips its children, and no child can report a height back up. Any
          hover animation below is transform/opacity only. */}
      <div className="relative aspect-square overflow-hidden bg-cream-100">
        <Link
          href={productPath(product.slug)}
          aria-label={product.title}
          className="absolute inset-0 block"
        >
          {poster ? (
            <Image
              src={poster}
              alt={product.media_3d?.alt_text ?? product.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover"
            />
          ) : (
            <MediaPlaceholder />
          )}
        </Link>

        {hasModel && (
          <span className="pointer-events-none absolute top-2 end-2 rounded-full bg-ink/80 px-2.5 py-1 text-[11px] font-bold text-cream-50">
            {HAS_MODEL_BADGE_LABEL}
          </span>
        )}

        {/* A pricing problem outranks a stock one: a product with no toman
            amount cannot be sold even when it is sitting on the shelf. */}
        {!purchasable ? (
          <span className="absolute top-2 start-2 rounded-full bg-amber-600/90 px-2.5 py-1 text-[11px] font-bold text-cream-50">
            قیمت در حال بررسی
          </span>
        ) : !inStock ? (
          <span className="absolute top-2 start-2 rounded-full bg-ink/80 px-2.5 py-1 text-[11px] font-bold text-cream-50">
            ناموجود
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <Badge color={product.category ? theme.primary : null}>
          {categoryLabel(product.category)}
        </Badge>

        <h3 className="line-clamp-2 text-base font-bold leading-snug">
          <Link href={productPath(product.slug)} className="hover:underline">
            {product.title}
          </Link>
        </h3>

        {hasModel && (
          <Link
            href={productPath(product.slug)}
            aria-label={`${VIEW_MODEL_LABEL} — ${product.title}`}
            className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:underline"
          >
            <span aria-hidden>🧊</span>
            {VIEW_MODEL_LABEL}
          </Link>
        )}

        <div className="mt-auto flex items-center justify-between gap-2">
          <Price
            value={product.price}
            currency={product.currency}
            wasValue={product.compare_at_price ?? null}
            size="md"
            accentColor={theme.primary}
          />

          <button
            type="button"
            onClick={quickAdd}
            disabled={!inStock || !purchasable}
            aria-label={`افزودن ${product.title} به سبد خرید`}
            title={
              purchasable ? undefined : 'قیمت تومانی این محصول هنوز نهایی نشده است.'
            }
            className="rounded-md border border-ink/15 bg-cream-50 px-3 py-2 text-xs font-bold text-ink/80 transition hover:bg-cream-100 disabled:opacity-40"
          >
            {added ? '✓' : 'افزودن'}
          </button>
        </div>
      </div>
    </article>
  );
}
