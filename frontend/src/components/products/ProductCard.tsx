'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import ModelPreview from '@/src/components/3d/ModelPreview';
import Badge from '@/src/components/ui/Badge';
import Price from '@/src/components/ui/Price';
import { resolveTheme } from '@/src/lib/theme';
import { useCartStore } from '@/src/store/useCartStore';
import { isPurchasable, type Product } from '@/src/types/product';

/**
 * Catalog card, shared by the home rails, category grids and search results.
 *
 * The 3D preview is opt-in: it mounts a small canvas only while the pointer is
 * over the card on a hover-capable device (after a short intent delay), or after
 * an explicit tap on the "3D" toggle on touch. A grid therefore never boots more
 * than the one canvas the user is actually looking at.
 */
export default function ProductCard({ product }: { product: Product }) {
  const addItem = useCartStore((state) => state.addItem);
  const theme = resolveTheme(product.category?.theme_config);

  const poster = product.media_3d?.thumbnail_url ?? null;
  const modelUrl = product.media_3d?.url ?? null;
  const inStock = product.stock > 0;
  // Distinct from `inStock`: the row exists and may be in stock, but has no
  // toman amount yet, so it cannot be sold at any price.
  const purchasable = isPurchasable(product);

  const [preview, setPreview] = useState(false);
  const [added, setAdded] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startPreview = () => {
    if (!modelUrl) return;
    hoverTimer.current = setTimeout(() => setPreview(true), 180);
  };

  const stopPreview = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setPreview(false);
  };

  const quickAdd = () => {
    // `addItem` refuses a product with no toman amount, so only claim success
    // when the line really went into the cart.
    setAdded(addItem(product, 1));
  };

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-lg bg-surface shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-pop">
      <div
        className="relative aspect-square bg-cream-100"
        onMouseEnter={startPreview}
        onMouseLeave={stopPreview}
      >
        <Link href={`/products/${product.slug}`} aria-label={product.title}>
          {poster ? (
            <Image
              src={poster}
              alt={product.media_3d?.alt_text ?? product.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className={`object-cover transition-opacity duration-300 ${
                preview ? 'opacity-0' : 'opacity-100'
              }`}
            />
          ) : (
            <span className="grid h-full w-full place-items-center text-3xl">
              🧸
            </span>
          )}
        </Link>

        {preview && modelUrl && (
          <ModelPreview modelUrl={modelUrl} className="absolute inset-0" />
        )}

        {modelUrl && (
          <button
            type="button"
            onClick={() => setPreview((value) => !value)}
            aria-pressed={preview}
            aria-label={preview ? 'بستن نمای سه‌بعدی' : 'نمایش سه‌بعدی'}
            className="absolute top-2 end-2 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-bold text-ink/80 shadow-card backdrop-blur transition hover:bg-surface"
          >
            ۳D
          </button>
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
        {product.category && (
          <Badge color={theme.primary}>{product.category.name}</Badge>
        )}

        <h3 className="line-clamp-2 text-base font-bold leading-snug">
          <Link href={`/products/${product.slug}`} className="hover:underline">
            {product.title}
          </Link>
        </h3>

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
