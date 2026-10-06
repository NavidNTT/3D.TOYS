import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import OrderStatusBadge from '@/src/components/orders/OrderStatusBadge';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import Card from '@/src/components/ui/Card';
import Container from '@/src/components/ui/Container';
import Price from '@/src/components/ui/Price';
import { formatDateFa, toPersianDigits } from '@/src/lib/format';
import { getServerSessionUser } from '@/src/lib/auth/session';
import { getMyOrderById, isOrderApiError } from '@/src/services/orderService';

/**
 * Order confirmation (`/orders/success/[id]`).
 *
 * Reached straight after checkout. There is no payment step: the order was
 * created as `pending` and this page is the end of the flow for now.
 */
export const dynamic = 'force-dynamic';

type SuccessProps = { params: Promise<{ id: string }> };

export const metadata: Metadata = {
  title: 'سفارش ثبت شد | Toy Store',
};

export default async function OrderSuccessPage({ params }: SuccessProps) {
  const { id } = await params;
  const orderId = Number.parseInt(id, 10);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    notFound();
  }

  const loginPath = `/login?next=${encodeURIComponent(`/orders/success/${orderId}`)}`;
  const user = await getServerSessionUser();

  if (user === null) {
    redirect(loginPath);
  }

  let loadError: string | null = null;
  let order: Awaited<ReturnType<typeof getMyOrderById>> = null;

  try {
    order = await getMyOrderById(orderId);
  } catch (error) {
    if (isOrderApiError(error) && error.status === 401) {
      redirect(loginPath);
    }

    loadError = isOrderApiError(error)
      ? error.message
      : 'دریافت سفارش ناموفق بود. لطفاً دوباره تلاش کنید.';
  }

  if (loadError !== null) {
    return (
      <Container className="py-8">
        <Card className="mt-8 border border-red-200 bg-red-50 p-6 text-center">
          <p role="alert" className="text-sm font-bold text-red-700">
            {loadError}
          </p>
          <Link
            href="/orders"
            className="mt-4 inline-block rounded-md bg-brand-500 px-5 py-3 text-sm font-bold text-white shadow-card transition hover:bg-brand-600"
          >
            مشاهده سفارش‌ها
          </Link>
        </Card>
      </Container>
    );
  }

  if (order === null) {
    notFound();
  }

  return (
    <Container className="py-10">
      <Breadcrumbs
        items={[
          { label: 'سفارش‌های من', href: '/orders' },
          { label: 'تأیید سفارش' },
        ]}
      />

      <Card className="mx-auto mt-8 max-w-2xl p-8 text-center">
        <p className="text-5xl" aria-hidden>
          🎉
        </p>

        <h1 className="mt-4 font-display text-3xl text-ink">
          سفارش شما با موفقیت ثبت شد
        </h1>

        <p className="mt-3 text-sm leading-7 text-ink/60">
          از خرید شما سپاسگزاریم. کارشناسان فروشگاه برای هماهنگی ارسال با شما
          تماس می‌گیرند.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          <div>
            <p className="text-xs text-ink/50">شماره سفارش</p>
            <p className="tnum font-display text-xl text-ink">
              {toPersianDigits(order.order_number)}
            </p>
          </div>

          <OrderStatusBadge status={order.status} label={order.status_label} />
        </div>

        <dl className="mx-auto mt-6 max-w-sm space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink/60">تاریخ ثبت</dt>
            <dd className="font-bold text-ink">{formatDateFa(order.created_at)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink/60">تعداد اقلام</dt>
            <dd className="tnum font-bold text-ink">{order.items.length}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink/60">مبلغ کل</dt>
            <dd>
              <Price value={order.total_amount} size="md" />
            </dd>
          </div>
        </dl>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/orders"
            className="rounded-md bg-brand-500 px-5 py-3 text-sm font-bold text-white shadow-card transition hover:bg-brand-600"
          >
            مشاهده سفارش‌های من
          </Link>
          <Link
            href="/categories"
            className="rounded-md border border-ink/15 bg-surface px-5 py-3 text-sm font-bold text-ink/80 transition hover:bg-cream-100"
          >
            ادامه خرید
          </Link>
        </div>
      </Card>
    </Container>
  );
}