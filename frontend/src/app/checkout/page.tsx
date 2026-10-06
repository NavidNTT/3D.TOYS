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

      <h1 className="mt-4 font-display text-3xl text-ink">تسویه خرید</h1>

      <div className="mt-6">
        <CheckoutView user={user} />
      </div>
    </Container>
  );
}
