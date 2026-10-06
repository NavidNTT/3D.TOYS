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
import type { Order } from '@/src/types/order';

/**
 * Order detail (`/orders/[id]`).
 *
 * Scoping is inherited from the API: `my-orders` only ever returns the signed-in
 * customer's orders, so an id that is not in that list behaves exactly like one
 * that does not exist — both are a 404, never someone else's order.
 */
export const dynamic = 'force-dynamic';

type OrderDetailProps = { params: Promise<{ id: string }> };

export async function generateMetadata({
  params,
}: OrderDetailProps): Promise<Metadata> {
  const { id } = await params;

  return { title: `سفارش ${toPersianDigits(id)} | Toy Store` };
}

export default async function OrderDetailPage({ params }: OrderDetailProps) {
  const { id } = await params;
  const orderId = Number.parseInt(id, 10);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    notFound();
  }

  const user = await getServerSessionUser();
  const loginPath = `/login?next=${encodeURIComponent(`/orders/${orderId}`)}`;

  if (user === null) {
    redirect(loginPath);
  }

  let order: Order | null = null;
  let loadError: string | null = null;

  try {
    order = await getMyOrderById(orderId);
  } catch (error) {
    // A stale cookie reads as "sign in again", not as a server fault.
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
        <Breadcrumbs
          items={[
            { label: 'سفارش‌های من', href: '/orders' },
            { label: 'جزئیات سفارش' },
          ]}
        />
        <Card className="mt-6 border border-red-200 bg-red-50 p-5">
          <p role="alert" className="text-sm font-bold text-red-700">
            {loadError}
          </p>
        </Card>
      </Container>
    );
  }

  if (order === null) {
    notFound();
  }

  return (
    <Container className="py-8">
      <Breadcrumbs
        items={[
          { label: 'سفارش‌های من', href: '/orders' },
          { label: toPersianDigits(order.order_number) },
        ]}
      />

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <h1 className="font-display text-3xl text-ink">
          سفارش {toPersianDigits(order.order_number)}
        </h1>
        <OrderStatusBadge status={order.status} label={order.status_label} />
      </div>

      <p className="mt-1 text-sm text-ink/60">
        ثبت‌شده در {formatDateFa(order.created_at)}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <h2 className="font-display text-xl text-ink">اقلام سفارش</h2>

            <ul className="mt-4 divide-y divide-ink/10">
              {order.items.map((item, index) => (
                <li
                  key={`${item.product_id ?? 'line'}-${index}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="line-clamp-2 font-bold text-ink">
                      {item.product_title}
                    </p>
                    <p className="tnum mt-0.5 text-xs text-ink/50">
                      تعداد {item.quantity} ×{' '}
                      <Price value={item.unit_price} size="sm" className="inline" />
                    </p>
                  </div>

                  <Price value={item.total_price} size="md" />
                </li>
              ))}
            </ul>

            <div className="mt-4 flex items-center justify-between border-t border-ink/10 pt-4">
              <span className="text-sm font-bold text-ink/70">جمع کل</span>
              <Price value={order.total_amount} size="lg" />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-xl text-ink">نشانی تحویل</h2>

            <dl className="mt-3 space-y-2 text-sm">
              <Row label="نام گیرنده" value={order.receiver_name} />
              <Row
                label="شماره تماس"
                value={toPersianDigits(order.receiver_phone)}
              />
              <Row
                label="استان / شهر"
                value={`${order.province ?? '—'}، ${order.city}`}
              />
              <Row label="نشانی" value={order.address} />
              <Row label="کد پستی" value={toPersianDigits(order.postal_code)} />
              {order.notes && <Row label="توضیحات" value={order.notes} />}
            </dl>
          </Card>
        </div>

        <aside>
          <Card className="space-y-3 p-5">
            <h2 className="font-display text-xl text-ink">راهنما</h2>
            <p className="text-sm leading-6 text-ink/60">
              برای هرگونه تغییر یا پیگیری، با شماره تماس فروشگاه در ارتباط
              باشید.
            </p>
            <Link
              href="/orders"
              className="block rounded-md border border-ink/15 bg-surface px-4 py-2.5 text-center text-sm font-bold text-ink/80 transition hover:bg-cream-100"
            >
              بازگشت به سفارش‌ها
            </Link>
          </Card>
        </aside>
      </div>
    </Container>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink/60">{label}</dt>
      <dd className="text-end font-bold text-ink">{value}</dd>
    </div>
  );
}
