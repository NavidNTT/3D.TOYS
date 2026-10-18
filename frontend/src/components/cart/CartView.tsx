'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Button from '@/src/components/ui/Button';
import Card from '@/src/components/ui/Card';
import EmptyState from '@/src/components/ui/EmptyState';
import MediaPlaceholder from '@/src/components/ui/MediaPlaceholder';
import Price from '@/src/components/ui/Price';
import Skeleton from '@/src/components/ui/Skeleton';
import { CURRENCY_IRT, formatNumberFa } from '@/src/lib/format';
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
      <EmptyState
        icon="🛒"
        title="سبد خرید شما خالی است"
        description="هنوز چیزی به سبد اضافه نکرده‌اید. از قفسه‌ها شروع کنید و اسباب‌بازی موردعلاقه‌تان را پیدا کنید."
        action={
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Link
              href="/categories"
              className="inline-flex items-center rounded-full bg-brand-500 px-6 py-3 text-sm font-bold text-white shadow-card transition hover:-translate-y-0.5 hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              مشاهده دسته‌بندی‌ها
            </Link>
            <Link
              href="/products"
              className="inline-flex items-center rounded-full border border-ink/15 bg-surface px-6 py-3 text-sm font-bold text-ink/80 transition hover:-translate-y-0.5 hover:bg-cream-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              همه محصولات
            </Link>
          </div>
        }
      />
    );
  }

  if (loading && quote === null) {
    return (
      <div
        className="grid gap-6 lg:grid-cols-3 lg:items-start"
        aria-busy="true"
        aria-live="polite"
      >
        <span className="sr-only">در حال دریافت قیمت سبد خرید</span>
        <div className="space-y-4 lg:col-span-2">
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="flex items-center gap-4 rounded-lg bg-surface p-4 shadow-card"
            >
              <Skeleton className="h-20 w-20 shrink-0 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3 rounded-full" />
                <Skeleton className="h-3 w-1/3 rounded-full" />
              </div>
              <Skeleton className="h-10 w-28 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
        <div className="space-y-4 rounded-lg bg-surface p-5 shadow-card lg:col-span-1">
          <Skeleton className="h-6 w-1/3 rounded-full" />
          <Skeleton className="h-4 w-full rounded-full" />
          <Skeleton className="h-4 w-full rounded-full" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
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
    <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
      <div className="space-y-4 lg:col-span-2">
        {unpricedItems.length > 0 && (
          <Card className="border border-toy-orange/40 bg-tint-orange/60 p-5">
            <p className="flex items-start gap-2 text-sm font-bold text-graphite-900">
              <span aria-hidden className="text-base leading-5">
                ⚠️
              </span>
              برخی اقلام دیگر در دسترس نیستند یا قیمت تومانی نهایی ندارند و قابل
              محاسبه نیستند.
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-graphite-700">
              {unpricedItems.map((item) => (
                <li
                  key={item.productId}
                  className="flex items-center justify-between gap-3 rounded-md bg-surface/70 px-3 py-2"
                >
                  <span className="truncate" dir="auto">
                    {item.slug}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(item.productId)}
                    className="shrink-0 rounded-full px-2 font-bold text-red-600 underline-offset-2 transition hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                  >
                    حذف
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <ul className="space-y-4">
          {quote.lines.map((line) => {
            const quantity = line.quantity;
            const atMax = quantity >= Math.min(line.product.stock, 99);

            return (
              <li key={line.product.id}>
                <Card className="p-4 transition hover:shadow-pop sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    {/* PRODUCT IMAGE — poster or the honest neutral placeholder. */}
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-cream-100 ring-1 ring-ink/5">
                      {line.product.media_3d?.thumbnail_url ? (
                        <Image
                          src={line.product.media_3d.thumbnail_url}
                          alt={line.product.title}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : (
                        <MediaPlaceholder label="بدون تصویر" />
                      )}
                    </div>

                    {/* IDENTITY — title and the server-priced unit amount. */}
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/products/${line.product.slug}`}
                        className="line-clamp-2 font-bold text-ink transition hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                      >
                        {line.product.title}
                      </Link>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-xs text-graphite-500">قیمت واحد</span>
                        <Price
                          value={line.product.price}
                          currency={line.product.currency}
                          size="sm"
                        />
                      </div>
                    </div>

                    {/* CONTROLS — quantity, line total and removal, grouped so
                        they stay reachable as one row on a phone. */}
                    <div className="flex items-center justify-between gap-3 sm:justify-end sm:gap-5">
                      <div
                        className="flex items-center overflow-hidden rounded-full border border-ink/15 bg-cream-50"
                        role="group"
                        aria-label={`تعداد ${line.product.title}`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(line.product.id, Math.max(0, quantity - 1))
                          }
                          aria-label="کاهش تعداد"
                          className="grid h-11 w-11 place-items-center text-lg font-bold text-ink/70 transition hover:bg-cream-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500"
                        >
                          −
                        </button>
                        <output className="tnum w-10 text-center text-sm font-bold text-ink">
                          {quantity}
                        </output>
                        <button
                          type="button"
                          onClick={() => updateQuantity(line.product.id, quantity + 1)}
                          disabled={atMax}
                          aria-label="افزایش تعداد"
                          className="grid h-11 w-11 place-items-center text-lg font-bold text-ink/70 transition hover:bg-cream-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>

                      <div className="min-w-[6rem] text-end">
                        {/* A line total exists only for a priced line, and every
                            priced line is toman by construction. */}
                        <Price
                          value={line.lineTotal}
                          currency={CURRENCY_IRT}
                          size="md"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(line.product.id)}
                        aria-label={`حذف ${line.product.title} از سبد`}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1.5 text-sm font-bold text-red-600 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                      >
                        <span aria-hidden>🗑</span>
                        حذف
                      </button>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      </div>

      <aside className="lg:sticky lg:top-20">
        <Card className="space-y-5 p-5 sm:p-6">
          <h2 className="font-display text-xl text-ink">خلاصه سفارش</h2>

          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-graphite-600">تعداد کالا</dt>
              <dd className="tnum font-bold text-ink">
                {formatNumberFa(quote.totalItems)} قلم
              </dd>
            </div>
            <div className="flex items-center justify-between border-t border-ink/10 pt-3">
              <dt className="font-bold text-ink">جمع کل</dt>
              <dd>
                <Price value={quote.subtotal} currency={CURRENCY_IRT} size="lg" />
              </dd>
            </div>
          </dl>

          <Link
            href={quote.lines.length > 0 ? '/checkout' : '/cart'}
            aria-disabled={quote.lines.length === 0}
            className={`block rounded-full px-5 py-3.5 text-center text-sm font-bold shadow-card transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
              quote.lines.length > 0
                ? 'bg-brand-500 text-white hover:-translate-y-0.5 hover:bg-brand-600'
                : 'pointer-events-none bg-ink/15 text-ink/45'
            }`}
          >
            تکمیل خرید
          </Link>

          <Link
            href="/categories"
            className="block text-center text-sm font-bold text-graphite-600 transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            ادامه خرید
          </Link>

          {/* Plain, true statements about the flow — nothing invented. */}
          <ul className="space-y-1.5 border-t border-ink/10 pt-4 text-xs text-graphite-600">
            <li className="flex items-center gap-2">
              <span aria-hidden>🧾</span>
              سفارش شما ثبت می‌شود؛ پرداخت آنلاین هنوز فعال نشده و پس از ثبت
              هماهنگ می‌شود.
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden>🔄</span>
              <Link
                href="/returns"
                className="font-bold text-graphite-700 underline-offset-4 transition hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                قوانین و بازگشت کالا
              </Link>
            </li>
          </ul>
        </Card>
      </aside>
    </div>
  );
}

