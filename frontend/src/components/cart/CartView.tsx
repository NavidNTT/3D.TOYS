'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Button from '@/src/components/ui/Button';
import Card from '@/src/components/ui/Card';
import Price from '@/src/components/ui/Price';
import Skeleton from '@/src/components/ui/Skeleton';
import { useCartStore } from '@/src/store/useCartStore';
import type { CartQuote } from '@/src/services/cartQuote';

/**
 * Cart body (client).
 *
 * The persisted store holds ids and quantities only, so this component asks the
 * server for a quote before rendering any number: a price on screen always
 * comes from the API, never from a localStorage snapshot. A line the server can
 * no longer price is reported rather than hidden.
 */
export default function CartView() {
  const items = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);

  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQuote = useCallback(async () => {
    if (items.length === 0) {
      setQuote({ lines: [], missingIds: [], unavailableSlugs: [], subtotal: 0, totalItems: 0 });
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/cart/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: items.map((item) => ({
            productId: item.productId,
            slug: item.slug,
            quantity: item.quantity,
          })),
        }),
      });

      const payload = (await response.json()) as {
        success: boolean;
        message: string;
        data: CartQuote | null;
      };

      if (!response.ok || !payload.success || payload.data === null) {
        setError(payload.message || 'قیمت‌گیری سبد خرید ناموفق بود.');
      } else {
        setQuote(payload.data);
      }
    } catch {
      setError('ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.');
    } finally {
      setLoading(false);
    }
  }, [items]);

  useEffect(() => {
    void loadQuote();
  }, [loadQuote]);

  if (items.length === 0) {
    return (
      <Card className="p-10 text-center">
        <p className="text-4xl">🛒</p>
        <h1 className="mt-4 font-display text-2xl text-ink">سبد خرید شما خالی است</h1>
        <p className="mt-2 text-sm text-ink/60">
          هنوز چیزی به سبد اضافه نکرده‌اید. از دسته‌بندی‌ها شروع کنید.
        </p>
        <Link
          href="/categories"
          className="mt-6 inline-block rounded-md bg-brand-500 px-5 py-3 text-sm font-bold text-white shadow-card transition hover:bg-brand-600"
        >
          مشاهده دسته‌بندی‌ها
        </Link>
      </Card>
    );
  }

  if (loading && quote === null) {
    return (
      <div className="space-y-4" aria-busy="true" aria-live="polite">
        <span className="sr-only">در حال دریافت قیمت سبد خرید</span>
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error !== null) {
    return (
      <Card className="p-8 text-center">
        <p role="alert" className="text-sm font-bold text-red-700">
          {error}
        </p>
        <Button variant="secondary" className="mt-4" onClick={() => void loadQuote()}>
          تلاش دوباره
        </Button>
      </Card>
    );
  }

  // Unreachable in practice (the branches above cover loading and failure), but
  // TypeScript cannot prove it — and an unpriced cart must never render.
  if (quote === null) return null;

  const unpricedItems = items.filter(
    (item) =>
      quote.missingIds.includes(item.productId) ||
      quote.unavailableSlugs.includes(item.slug),
  );

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {unpricedItems.length > 0 && (
          <Card className="border border-amber-300/60 bg-amber-50 p-4">
            <p className="text-sm font-bold text-amber-900">
              برخی اقلام دیگر در دسترس نیستند و قابل محاسبه نیستند.
            </p>
            <ul className="mt-2 space-y-1 text-sm text-amber-900/80">
              {unpricedItems.map((item) => (
                <li
                  key={item.productId}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="truncate">{item.slug}</span>
                  <button
                    type="button"
                    onClick={() => removeItem(item.productId)}
                    className="shrink-0 font-bold underline"
                  >
                    حذف
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {quote.lines.map((line) => {
          const quantity = line.quantity;

          return (
            <Card key={line.product.id} className="flex flex-wrap items-center gap-4 p-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-cream-100">
                {line.product.media_3d?.thumbnail_url ? (
                  <Image
                    src={line.product.media_3d.thumbnail_url}
                    alt={line.product.title}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <span className="grid h-full w-full place-items-center text-2xl">
                    🧸
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <Link
                  href={`/products/${line.product.slug}`}
                  className="line-clamp-2 font-bold text-ink hover:underline"
                >
                  {line.product.title}
                </Link>
                <div className="mt-1">
                  <Price value={line.product.price} size="sm" />
                </div>
              </div>

              <div
                className="flex items-center rounded-md border border-ink/15 bg-surface"
                role="group"
                aria-label={`تعداد ${line.product.title}`}
              >
                <button
                  type="button"
                  onClick={() =>
                    updateQuantity(line.product.id, Math.max(0, quantity - 1))
                  }
                  aria-label="کاهش تعداد"
                  className="grid h-9 w-9 place-items-center font-bold text-ink/70 hover:bg-cream-100"
                >
                  −
                </button>
                <output className="tnum w-9 text-center text-sm font-bold">
                  {quantity}
                </output>
                <button
                  type="button"
                  onClick={() => updateQuantity(line.product.id, quantity + 1)}
                  disabled={quantity >= Math.min(line.product.stock, 99)}
                  aria-label="افزایش تعداد"
                  className="grid h-9 w-9 place-items-center font-bold text-ink/70 hover:bg-cream-100 disabled:opacity-40"
                >
                  +
                </button>
              </div>

              <div className="w-32 text-end">
                <Price value={line.lineTotal} size="md" />
              </div>

              <button
                type="button"
                onClick={() => removeItem(line.product.id)}
                aria-label={`حذف ${line.product.title} از سبد`}
                className="text-sm font-bold text-red-600 hover:underline"
              >
                حذف
              </button>
            </Card>
          );
        })}
      </div>

      <aside>
        <Card className="space-y-4 p-5">
          <h2 className="font-display text-xl text-ink">خلاصه سفارش</h2>

          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink/60">تعداد کالا</dt>
              <dd className="tnum font-bold">{quote.totalItems}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/60">جمع کل</dt>
              <dd>
                <Price value={quote.subtotal} size="md" />
              </dd>
            </div>
          </dl>

          <Link
            href={quote.lines.length > 0 ? '/checkout' : '/cart'}
            aria-disabled={quote.lines.length === 0}
            className={`block rounded-md px-5 py-3 text-center text-sm font-bold shadow-card transition ${
              quote.lines.length > 0
                ? 'bg-brand-500 text-white hover:bg-brand-600'
                : 'pointer-events-none bg-ink/20 text-ink/50'
            }`}
          >
            تکمیل خرید
          </Link>

          <Link
            href="/categories"
            className="block text-center text-sm font-bold text-ink/70 hover:text-ink"
          >
            ادامه خرید
          </Link>
        </Card>
      </aside>
    </div>
  );
}

