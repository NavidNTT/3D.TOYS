'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import api from '@/src/lib/api';
import { formatDateFa, formatNumberFa } from '@/src/lib/format';
import { useMounted } from '@/src/lib/useMounted';
import { useAuthStore } from '@/src/store/useAuthStore';
import type { Order, OrderStatus } from '@/src/types/order';
import type { ApiEnvelope } from '@/src/types/product';

/**
 * Persian label + Tailwind palette per lifecycle state. Kept as one table so the
 * status badge and any future filter stay in agreement. `unknown` covers a state
 * this client has not been taught yet.
 */
const STATUS_META: Record<
  OrderStatus,
  { label: string; className: string }
> = {
  pending: {
    label: 'در انتظار پرداخت',
    className: 'border-amber-400/40 bg-amber-400/15 text-amber-300',
  },
  paid: {
    label: 'پرداخت‌شده',
    className: 'border-blue-400/40 bg-blue-400/15 text-blue-300',
  },
  processing: {
    label: 'در حال آماده‌سازی',
    className: 'border-purple-400/40 bg-purple-400/15 text-purple-300',
  },
  completed: {
    label: 'ارسال شد',
    className: 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300',
  },
  cancelled: {
    label: 'لغو شده',
    className: 'border-rose-400/40 bg-rose-400/15 text-rose-300',
  },
};

const UNKNOWN_STATUS = {
  label: 'نامشخص',
  className: 'border-white/20 bg-white/10 text-white/70',
};

function statusMeta(status: OrderStatus) {
  return STATUS_META[status] ?? UNKNOWN_STATUS;
}

/** Order totals carry no currency code of their own; render in Toman. */
function formatToman(value: number): string {
  return `${formatNumberFa(value)} تومان`;
}

export default function OrdersPage() {
  const router = useRouter();
  const mounted = useMounted();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Persisted auth only exists after hydration, so a signed-out redirect waits
  // for `mounted` to avoid bouncing a logged-in user on first paint.
  useEffect(() => {
    if (mounted && !isAuthenticated) router.replace('/login');
  }, [mounted, isAuthenticated, router]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<ApiEnvelope<Order[]>>('/orders/my-orders');

      setOrders(response.data.data ?? []);
    } catch (exception) {
      // An expired token is an auth problem, not a fetch problem: send the
      // customer to log in again instead of showing a retry loop.
      if (axios.isAxiosError(exception) && exception.response?.status === 401) {
        router.replace('/login');

        return;
      }

      setError('دریافت سفارش‌ها ناموفق بود. لطفاً دوباره تلاش کنید.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!mounted || !isAuthenticated) return;

    void loadOrders();
  }, [mounted, isAuthenticated, loadOrders]);

  // Persisted stores only exist after hydration: show the same skeleton the
  // server rendered until then, so hydration stays warning-free.
  if (!mounted || (isAuthenticated && loading)) {
    return <OrdersSkeleton />;
  }

  if (!isAuthenticated) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-6 py-24 text-center">
        <p className="text-sm text-white/50">در حال انتقال به صفحه ورود…</p>
        <Link
          href="/login"
          className="rounded-xl bg-sky-500 px-5 py-3 font-bold text-white shadow-block transition hover:bg-sky-600"
        >
          ورود به حساب
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-black">سفارش‌های من</h1>
        <p className="text-sm text-white/60">
          سفارش‌های ثبت‌شدهٔ خود را اینجا پیگیری کنید.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="mt-8 flex flex-col items-start gap-3 rounded-2xl border border-brick-400/40 bg-brick-500/10 p-5 text-sm text-brick-400 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadOrders()}
            className="rounded-lg border border-brick-400/40 px-3 py-2 font-bold transition hover:bg-brick-500/20"
          >
            تلاش دوباره
          </button>
        </div>
      )}

      {!error && orders.length === 0 && <EmptyOrders />}

      {orders.length > 0 && (
        <ul className="mt-8 space-y-6">
          {orders.map((order) => (
            <li key={order.id}>
              <OrderCard order={order} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function OrderCard({ order }: { order: Order }) {
  const meta = statusMeta(order.status);

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-block">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-5 py-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
            شماره سفارش
          </p>
          <p
            dir="ltr"
            className="select-all break-all font-mono text-sm font-black text-sky-400"
          >
            {order.order_number}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-white/50">
            {formatDateFa(order.created_at)}
          </span>
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${meta.className}`}
          >
            {meta.label}
          </span>
        </div>
      </header>

      <div className="space-y-5 p-5">
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
            اقلام سفارش
          </h2>
          <ul className="space-y-3">
            {order.items.map((item, index) => (
              <li
                key={`${item.product_id ?? 'line'}-${index}`}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {item.product_title}
                  </span>
                  <span className="text-xs text-white/50">
                    {formatNumberFa(item.quantity)} ×{' '}
                    {formatToman(item.unit_price)}
                  </span>
                </span>
                <span className="shrink-0 font-bold">
                  {formatToman(item.total_price)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-white/10 bg-[#0b1020] p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
            اطلاعات گیرنده و آدرس
          </h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <SummaryRow label="گیرنده" value={order.receiver_name} />
            <SummaryRow
              label="شماره تماس"
              value={order.receiver_phone}
              dir="ltr"
            />
            <SummaryRow label="شهر" value={order.city} />
            <SummaryRow label="کد پستی" value={order.postal_code} dir="ltr" />
            <div className="sm:col-span-2">
              <SummaryRow label="آدرس" value={order.address} />
            </div>
          </dl>
        </section>

        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <span className="text-sm text-white/60">مبلغ کل</span>
          <span className="text-lg font-black text-sky-400">
            {formatToman(order.total_amount)}
          </span>
        </div>
      </div>
    </article>
  );
}

function SummaryRow({
  label,
  value,
  dir,
}: {
  label: string;
  value: string;
  dir?: 'ltr' | 'rtl';
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-white/40">{label}</dt>
      <dd dir={dir} className="min-w-0 break-words text-white/80">
        {value}
      </dd>
    </div>
  );
}

function EmptyOrders() {
  return (
    <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-12 text-center shadow-block">
      <span aria-hidden className="text-5xl">
        📦
      </span>
      <h2 className="text-xl font-black">هنوز سفارشی ثبت نکرده‌اید</h2>
      <p className="max-w-sm text-sm text-white/60">
        اولین اسباب‌بازی‌تان را انتخاب کنید و سفارش‌های بعدی همین‌جا نمایش داده
        می‌شوند.
      </p>
      <Link
        href="/"
        className="rounded-xl bg-sky-500 px-5 py-3 font-bold text-white shadow-block transition hover:bg-sky-600"
      >
        مشاهدهٔ محصولات
      </Link>
    </div>
  );
}

function OrdersSkeleton() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-white/10" />
        <div className="h-4 w-72 animate-pulse rounded-lg bg-white/5" />
      </header>

      <div className="mt-8 space-y-6" aria-hidden>
        {[0, 1].map((key) => (
          <div
            key={key}
            className="space-y-5 rounded-2xl border border-white/10 bg-white/5 p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="h-5 w-40 animate-pulse rounded bg-white/10" />
              <div className="h-6 w-28 animate-pulse rounded-full bg-white/10" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-white/10" />
            </div>
            <div className="h-20 animate-pulse rounded-xl bg-white/5" />
          </div>
        ))}
      </div>
    </main>
  );
}
