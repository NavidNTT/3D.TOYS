import type { Metadata } from 'next';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import Container from '@/src/components/ui/Container';
import CartView from '@/src/components/cart/CartView';

/**
 * Cart page.
 *
 * The body is a client component because the cart itself is client state; the
 * amounts it renders come from `/api/cart/quote`, so nothing is computed from a
 * stored price snapshot.
 */
export const metadata: Metadata = {
  title: 'سبد خرید | Toy Store',
};

export default function CartPage() {
  return (
    <Container className="py-8">
      <Breadcrumbs items={[{ label: 'سبد خرید' }]} />

      <h1 className="mt-4 font-display text-3xl text-ink">سبد خرید</h1>

      <div className="mt-6">
        <CartView />
      </div>
    </Container>
  );
}
