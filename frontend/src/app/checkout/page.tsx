import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import CheckoutView from '@/src/components/checkout/CheckoutView';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import Container from '@/src/components/ui/Container';
import { getServerSessionUser } from '@/src/lib/auth/session';

/**
 * Checkout (`/checkout`).
 *
 * Checkout requires an account (the API's order routes sit behind
 * `auth:sanctum`), so a guest is sent to the OTP login and returned here
 * afterwards. Everything below renders from server-priced data.
 *
 * Payments are out of scope: the flow ends at a `pending` order and a clearly
 * marked "coming soon" slot for the gateway.
 */
export const metadata: Metadata = {
  title: 'تسویه خرید | Toy Store',
};

export default async function CheckoutPage() {
  const user = await getServerSessionUser();

  if (user === null) {
    redirect('/login?next=/checkout');
  }

  return (
    <Container className="py-8">
      <Breadcrumbs
        items={[
          { label: 'سبد خرید', href: '/cart' },
          { label: 'تسویه خرید' },
        ]}
      />

      <section className="relative isolate mt-4 overflow-hidden rounded-[2rem] bg-cream-100 px-5 py-8 sm:rounded-[2.5rem] sm:px-8 sm:py-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-16 -top-16 -z-10 h-56 w-56 rounded-full bg-toy-lime/40 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 right-1/4 -z-10 h-52 w-52 rounded-full bg-brand-500/10 blur-3xl"
        />

        <p className="text-[10px] font-black tracking-[0.2em] text-brand-500">
          CHECKOUT
        </p>
        <h1 className="mt-3 font-display text-3xl leading-tight text-ink sm:text-4xl">
          تسویه خرید
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-graphite-700">
          نشانی تحویل را کامل کن تا سفارشت ثبت شود. هنگام ثبت، مبلغ همه اقلام
          دوباره از فروشگاه خوانده می‌شود.
        </p>
      </section>

      <div className="mt-6">
        <CheckoutView user={user} />
      </div>
    </Container>
  );
}
