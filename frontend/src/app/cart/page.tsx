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
          CART
        </p>
        <h1 className="mt-3 font-display text-3xl leading-tight text-ink sm:text-4xl">
          سبد خرید
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-graphite-700">
          اقلام انتخابی‌ات را یک‌جا مرور کن، تعداد را تنظیم کن و سفارش را نهایی
          کن. همه قیمت‌ها به‌صورت زنده از فروشگاه گرفته می‌شوند.
        </p>
      </section>

      <div className="mt-6">
        <CartView />
      </div>
    </Container>
  );
}
