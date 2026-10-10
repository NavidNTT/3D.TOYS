import type { Metadata } from 'next';
import Link from 'next/link';
import OrderStatusBadge from '@/src/components/orders/OrderStatusBadge';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import Card from '@/src/components/ui/Card';
import Container from '@/src/components/ui/Container';
import EmptyState from '@/src/components/ui/EmptyState';
import Price from '@/src/components/ui/Price';
import { formatDateFa, toPersianDigits } from '@/src/lib/format';
import { getServerSessionUser } from '@/src/lib/auth/session';
import { getMyOrders, isOrderApiError } from '@/src/services/orderService';
import type { Order } from '@/src/types/order';

/**
 * Order history (`/orders`).
 *
 * A server component: the session comes straight from the httpOnly cookie, so
 * this page needs no client JavaScript to know who is looking at it. Both
 * unauthenticated and API-failure states are rendered in place rather than
 * thrown — a signed-out visitor gets a sign-in prompt, not an error page.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'سفارش‌های من | Toy Store',
};

const SIGN_IN_NEXT = encodeURIComponent('/orders');

export default async function OrdersPage() {
  const user = await getServerSessionUser();

  if (user === null) {
    return (
      <Container className="py-8">
        <Breadcrumbs items={[{ label: 'سفارش‌های من' }]} />

        <div className="mt-8">
          <EmptyState
            icon="🔐"
            title="برای دیدن سفارش‌ها وارد شوید"
            description="با شماره موبایل خود وارد شوید تا سفارش‌های قبلی‌تان را ببینید."
            action={
              <Link
                href={`/login?next=${SIGN_IN_NEXT}`}
                className="rounded-md bg-brand-500 px-5 py-3 text-sm font-bold text-white shadow-card transition hover:bg-brand-600"
              >
                ورود به حساب
              </Link>
            }
          />
        </div>
      </Container>
    );
  }

  let orders: Order[] = [];
  let loadError: string | null = null;

  try {
    orders = await getMyOrders();
  } catch (error) {
    // A stale cookie reads as "signed out", not as a server fault.
    if (isOrderApiError(error) && error.status === 401) {
      return (
        <Container className="py-8">
          <Breadcrumbs items={[{ label: 'سفارش‌های من' }]} />
          <div className="mt-8">
            <EmptyState
              icon="🔐"
              title="نشست شما منقضی شده است"
              description="برای ادامه دوباره وارد حساب خود شوید."
              action={
                <Link
                  href={`/login?next=${SIGN_IN_NEXT}`}
                  className="rounded-md bg-brand-500 px-5 py-3 text-sm font-bold text-white shadow-card transition hover:bg-brand-600"
                >
                  ورود به حساب
                </Link>
              }
            />
          </div>
        </Container>
      );
    }

    loadError = isOrderApiError(error)
      ? error.message
      : 'دریافت سفارش‌ها ناموفق بود. لطفاً دوباره تلاش کنید.';
  }

  return (
    <Container className="py-8">
      <Breadcrumbs items={[{ label: 'سفارش‌های من' }]} />

      <h1 className="mt-4 font-display text-3xl text-ink">سفارش‌های من</h1>

      {loadError !== null && (
        <Card className="mt-6 border border-red-200 bg-red-50 p-5">
          <p role="alert" className="text-sm font-bold text-red-700">
            {loadError}
          </p>
        </Card>
      )}

      {loadError === null && orders.length === 0 && (
        <div className="mt-8">
          <EmptyState
            icon="🧾"
            title="هنوز سفارشی ثبت نکرده‌اید"
            description="پس از ثبت اولین سفارش، اینجا نمایش داده می‌شود."
            action={
              <Link
                href="/categories"
                className="rounded-md bg-brand-500 px-5 py-3 text-sm font-bold text-white shadow-card transition hover:bg-brand-600"
              >
                شروع خرید
              </Link>
            }
          />
        </div>
      )}

      {loadError === null && orders.length > 0 && (
        <ul className="mt-6 space-y-4">
          {orders.map((order) => (
            <li key={order.id}>
              <Link href={`/orders/${order.id}`} className="block">
                <Card className="flex flex-wrap items-center gap-x-6 gap-y-3 p-5 transition hover:shadow-pop">
                  <div>
                    <p className="tnum text-xs text-ink/50">شماره سفارش</p>
                    <p className="font-bold text-ink">
                      {toPersianDigits(order.order_number)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-ink/50">تاریخ ثبت</p>
                    <p className="text-sm font-bold text-ink">
                      {formatDateFa(order.created_at)}
                    </p>
                  </div>

                  <OrderStatusBadge
                    status={order.status}
                    label={order.status_label}
                  />

                  <div className="ms-auto text-end">
                    <p className="text-xs text-ink/50">مبلغ</p>
                    <Price
                      value={order.total_amount}
                      currency={order.currency}
                      size="md"
                    />
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
