'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Button from '@/src/components/ui/Button';
import Card from '@/src/components/ui/Card';
import EmptyState from '@/src/components/ui/EmptyState';
import Input from '@/src/components/ui/Input';
import Price from '@/src/components/ui/Price';
import Skeleton from '@/src/components/ui/Skeleton';
import Textarea from '@/src/components/ui/Textarea';
import { CURRENCY_IRT } from '@/src/lib/format';
import {
  isValidIranianPhone,
  normalizePhone,
  normalizePostalCode,
} from '@/src/lib/persian';
import type { CartQuote } from '@/src/services/cartQuote';
import { checkoutGate } from '@/src/services/checkoutGate';
import type { SessionUser } from '@/src/lib/auth/session';
import type { Order } from '@/src/types/order';

/**
 * Checkout body (client).
 *
 * Prices come from `/api/cart/quote` — the same server pricing the cart uses —
 * and the submitted payload carries ids and quantities only, so nothing the
 * browser sends can influence the amount `OrderService` charges.
 *
 * PAYMENTS ARE OUT OF SCOPE for this engagement: the payment step is an
 * intentional, clearly-labelled placeholder (see the render below) and
 * submitting only creates a `pending` order.
 */
/**
 * The domain error shown when the cart holds a line checkout must refuse.
 * Failing closed beats silently submitting a subset of the cart: an order the
 * customer never saw the full picture of is worse than no order at all.
 */
const BLOCKED_SUMMARY =
  'برخی اقلام سبد خرید شما قیمت تومانی نهایی ندارند یا دیگر در دسترس نیستند. تا زمانی که این اقلام در سبد باشند، ثبت سفارش ممکن نیست.';

export default function CheckoutView({ user }: { user: SessionUser }) {
  const router = useRouter();

  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [receiverName, setReceiverName] = useState(user.name ?? '');
  const [receiverPhone, setReceiverPhone] = useState(user.phone ?? '');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [notes, setNotes] = useState('');

  const loadQuote = useCallback(async () => {
    const { useCartStore } = await import('@/src/store/useCartStore');
    const items = useCartStore.getState().items;

    if (items.length === 0) {
      setQuote({ lines: [], missingIds: [], unavailableSlugs: [], subtotal: 0, totalItems: 0 });
      setLoading(false);
      return;
    }

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

      const payload = (await response.json().catch(() => null)) as {
        success: boolean;
        data: CartQuote | null;
      };

      if (response.ok && payload?.success && payload.data !== null) {
        setQuote(payload.data);
      } else {
        setSubmitError('قیمت‌گیری سبد خرید ناموفق بود. دوباره تلاش کنید.');
      }
    } catch {
      setSubmitError('ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQuote();
  }, [loadQuote]);

  const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (receiverName.trim().length < 2) {
      errors.receiver_name = 'نام گیرنده باید حداقل ۲ نویسه باشد.';
    }
    if (!isValidIranianPhone(normalizePhone(receiverPhone))) {
      errors.receiver_phone = 'شماره تماس باید با ۰۹ شروع شود و ۱۱ رقم داشته باشد.';
    }
    if (province.trim() === '') errors.province = 'وارد کردن استان الزامی است.';
    if (city.trim() === '') errors.city = 'وارد کردن شهر الزامی است.';
    if (address.trim().length < 10) {
      errors.address = 'نشانی باید حداقل ۱۰ نویسه باشد.';
    }
    if (normalizePostalCode(postalCode).length !== 10) {
      errors.postal_code = 'کد پستی باید ۱۰ رقم عددی باشد.';
    }

    return errors;
  };

  const submit = async () => {
    const errors = validate();
    setFieldErrors(errors);
    setSubmitError(null);

    if (Object.keys(errors).length > 0 || quote === null) return;

    // Fail closed: never submit a subset of the cart while an unorderable line
    // is still in it — the render blocks the form, this guards the action.
    if (checkoutGate(quote).blocked) {
      setSubmitError(BLOCKED_SUMMARY);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiver_name: receiverName.trim(),
          receiver_phone: normalizePhone(receiverPhone),
          province: province.trim(),
          city: city.trim(),
          address: address.trim(),
          postal_code: normalizePostalCode(postalCode),
          notes: notes.trim() === '' ? null : notes.trim(),
          items: quote.lines.map((line) => ({
            product_id: line.product.id,
            quantity: line.quantity,
          })),
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
        data?: unknown;
      } | null;

      if (response.status === 401) {
        router.push('/login?next=/checkout');
        return;
      }

      if (!response.ok || !payload?.success) {
        // Laravel's 422 payload is `{field: [messages]}` — surface each message
        // against its own input rather than as one generic failure.
        if (
          response.status === 422 &&
          payload?.data &&
          typeof payload.data === 'object'
        ) {
          const mapped: Record<string, string> = {};

          for (const [field, messages] of Object.entries(
            payload.data as Record<string, unknown>,
          )) {
            if (Array.isArray(messages) && typeof messages[0] === 'string') {
              mapped[field] = messages[0];
            }
          }

          setFieldErrors(mapped);
        }

        setSubmitError(
          payload?.message ?? 'ثبت سفارش ناموفق بود. دوباره تلاش کنید.',
        );
        return;
      }

      const order = payload?.data as Order | null;

      if (!order || typeof order.id !== 'number') {
        setSubmitError('پاسخ سرور نامعتبر بود. دوباره تلاش کنید.');
        return;
      }

      const { useCartStore } = await import('@/src/store/useCartStore');
      useCartStore.getState().clearCart();

      router.push(`/orders/success/${order.id}`);
      router.refresh();
    } catch {
      setSubmitError('ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div
        className="grid gap-6 lg:grid-cols-3 lg:items-start"
        aria-busy="true"
        aria-live="polite"
      >
        <span className="sr-only">در حال آماده‌سازی سفارش</span>
        <div className="space-y-5 lg:col-span-2">
          <div className="space-y-4 rounded-lg bg-surface p-5 shadow-card">
            <Skeleton className="h-6 w-1/3 rounded-full" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-11 w-full rounded-lg" />
              <Skeleton className="h-11 w-full rounded-lg" />
              <Skeleton className="h-11 w-full rounded-lg" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
          <Skeleton className="h-28 w-full rounded-lg" />
        </div>
        <div className="space-y-4 rounded-lg bg-surface p-5 shadow-card lg:col-span-1">
          <Skeleton className="h-6 w-1/3 rounded-full" />
          <Skeleton className="h-4 w-full rounded-full" />
          <Skeleton className="h-4 w-2/3 rounded-full" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  // Fail closed before anything else renders: if the quote refused to price a
  // line the customer still has in the cart, checkout must stop with a clear
  // domain-level error instead of quietly presenting a smaller cart as final.
  const gate = quote === null ? null : checkoutGate(quote);

  if (gate !== null && gate.blocked) {
    const unorderable = [
      ...gate.unavailableSlugs,
      ...gate.missingIds.map((id) => `#${id}`),
    ];

    return (
      <Card className="overflow-hidden">
        <div
          aria-hidden="true"
          className="h-1.5 w-full bg-toy-orange"
        />
        <div className="px-6 py-10 text-center sm:px-10">
          <p className="text-4xl">⚠️</p>
          <h2 className="mt-4 font-display text-2xl text-ink">
            امکان ثبت سفارش نیست
          </h2>
          <p
            className="mx-auto mt-3 max-w-md rounded-md bg-red-50 px-4 py-3 text-sm font-bold text-red-700"
            role="alert"
          >
            {BLOCKED_SUMMARY}
          </p>
          {unorderable.length > 0 && (
            <ul className="mx-auto mt-4 max-w-md space-y-1.5 text-sm text-graphite-700">
              {unorderable.map((entry) => (
                <li
                  key={entry}
                  className="truncate rounded-md bg-cream-100 px-3 py-2"
                  dir="auto"
                >
                  {entry}
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/cart"
            className="mt-6 inline-flex items-center rounded-full bg-brand-500 px-6 py-3 text-sm font-bold text-white shadow-card transition hover:-translate-y-0.5 hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            بازگشت به سبد خرید
          </Link>
        </div>
      </Card>
    );
  }

  if (quote === null || quote.lines.length === 0) {
    return (
      <EmptyState
        icon="🛒"
        title="چیزی برای سفارش نیست"
        description="سبد خرید شما خالی است؛ ابتدا چیزی به آن اضافه کنید تا بتوانید سفارش را ثبت کنید."
        action={
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Link
              href="/cart"
              className="inline-flex items-center rounded-full bg-brand-500 px-6 py-3 text-sm font-bold text-white shadow-card transition hover:-translate-y-0.5 hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              بازگشت به سبد خرید
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

  return (
    <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
      <form
        id="checkout-form"
        className="space-y-5 lg:col-span-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        noValidate
      >
        {submitError && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700"
          >
            <span aria-hidden className="text-base leading-5">
              ⚠️
            </span>
            {submitError}
          </p>
        )}

        <Card className="space-y-5 p-5 sm:p-6">
          <div className="flex items-center gap-3 border-b border-ink/10 pb-4">
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-base"
            >
              📍
            </span>
            <div>
              <h2 className="font-display text-xl text-ink">نشانی تحویل</h2>
              <p className="text-xs text-graphite-600">
                اطلاعات گیرنده و نشانی دقیق را وارد کنید.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="checkout-name"
              label="نام گیرنده"
              value={receiverName}
              onChange={(event) => setReceiverName(event.target.value)}
              error={fieldErrors.receiver_name ?? null}
              required
            />
            <Input
              id="checkout-phone"
              label="شماره تماس"
              type="tel"
              inputMode="numeric"
              dir="ltr"
              value={receiverPhone}
              onChange={(event) => setReceiverPhone(event.target.value)}
              error={fieldErrors.receiver_phone ?? null}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="checkout-province"
              label="استان"
              value={province}
              onChange={(event) => setProvince(event.target.value)}
              error={fieldErrors.province ?? null}
              required
            />
            <Input
              id="checkout-city"
              label="شهر"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              error={fieldErrors.city ?? null}
              required
            />
          </div>

          <Textarea
            id="checkout-address"
            label="نشانی کامل"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            error={fieldErrors.address ?? null}
            hint="کوچه، پلاک و واحد را بنویسید."
            required
          />

          <Input
            id="checkout-postal"
            label="کد پستی"
            inputMode="numeric"
            dir="ltr"
            maxLength={10}
            value={postalCode}
            onChange={(event) =>
              setPostalCode(normalizePostalCode(event.target.value))
            }
            error={fieldErrors.postal_code ?? null}
            required
          />

          <Textarea
            id="checkout-notes"
            label="توضیحات (اختیاری)"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            error={fieldErrors.notes ?? null}
          />
        </Card>

        <Card className="space-y-4 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-tint-lime text-base"
            >
              💳
            </span>
            <h2 className="font-display text-xl text-ink">پرداخت</h2>
          </div>
          {/* PLACEHOLDER — payments are out of scope for this engagement.
              This is the empty spot where the gateway step belongs; orders are
              created as `pending` and nothing is charged. */}
          <div className="rounded-lg border border-dashed border-ink/25 bg-cream-100 px-4 py-6 text-center">
            <p className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-xs font-black text-graphite-600 shadow-card">
              <span aria-hidden>⏳</span>
              به‌زودی
            </p>
            <p className="mt-3 text-sm font-bold text-graphite-700">
              پرداخت آنلاین هنوز فعال نشده است.
            </p>
            <p className="mt-1 text-xs leading-5 text-graphite-500">
              در حال حاضر سفارش شما ثبت می‌شود و پرداخت پس از هماهنگی با شما
              انجام خواهد شد.
            </p>
          </div>
        </Card>
      </form>

      <aside className="lg:sticky lg:top-20">
        <Card className="space-y-5 p-5 sm:p-6">
          <h2 className="font-display text-xl text-ink">خلاصه سفارش</h2>

          <ul className="space-y-3 text-sm">
            {quote.lines.map((line) => (
              <li
                key={line.product.id}
                className="flex items-start justify-between gap-3 border-b border-ink/5 pb-3 last:border-b-0 last:pb-0"
              >
                <span className="min-w-0 flex-1 text-graphite-700">
                  <span className="line-clamp-2 font-bold text-ink">
                    {line.product.title}
                  </span>
                  <span className="tnum mt-0.5 block text-xs text-graphite-500">
                    تعداد: {line.quantity}
                  </span>
                </span>
                <Price
                  value={line.lineTotal}
                  currency={CURRENCY_IRT}
                  size="sm"
                  className="shrink-0"
                />
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between gap-3 border-t border-ink/10 pt-4">
            <span className="text-sm font-bold text-ink">جمع کل</span>
            <Price value={quote.subtotal} currency={CURRENCY_IRT} size="lg" />
          </div>

          <Button
            type="submit"
            form="checkout-form"
            size="lg"
            loading={submitting}
            className="w-full rounded-full"
          >
            ثبت سفارش
          </Button>

          <p className="text-center text-xs text-graphite-500">
            با ثبت سفارش، قوانین بازگشت کالا را می‌پذیرید.
          </p>
        </Card>
      </aside>
    </div>
  );
}

