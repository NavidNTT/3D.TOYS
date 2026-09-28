import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Order confirmed | Toy Store',
  description: 'Your toy order has been placed.',
  // A confirmation page carries a tracking number: keep it out of search.
  robots: { index: false, follow: false },
};

interface CheckoutSuccessPageProps {
  searchParams: { order_number?: string | string[] };
}

/**
 * Order confirmation.
 *
 * A server component: the tracking number comes straight from the query string
 * the checkout page redirected with, so nothing has to be fetched or stored
 * client-side to render it.
 */
export default function CheckoutSuccessPage({
  searchParams,
}: CheckoutSuccessPageProps) {
  const raw = searchParams.order_number;
  const orderNumber = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? '';

  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 py-20 text-center">
      <span
        aria-hidden
        className="grid h-16 w-16 place-items-center rounded-full border border-emerald-400/40 bg-emerald-400/15 text-3xl text-emerald-300"
      >
        ✓
      </span>

      <div className="space-y-3">
        <h1 className="text-3xl font-black sm:text-4xl">Order confirmed</h1>
        <p className="text-base text-white/70">
          Thanks! We received your order and will arrange delivery with you on
          the number you provided.
        </p>
      </div>

      {orderNumber ? (
        <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-6 shadow-block">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
            Tracking number
          </p>
          <p
            dir="ltr"
            className="mt-2 select-all break-all font-mono text-xl font-black text-sky-400 sm:text-2xl"
          >
            {orderNumber}
          </p>
          <p className="mt-3 text-xs text-white/40">
            Keep this number; quote it in any message about this order.
          </p>
        </div>
      ) : (
        <p className="w-full rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/60">
          We could not find a tracking number in this link. Check your order
          history or contact us and we will look it up.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-xl bg-sky-500 px-5 py-3 font-bold text-white shadow-block transition hover:bg-sky-600"
        >
          Back to the storefront
        </Link>
        <Link
          href="/products/sample"
          className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-bold text-white/80 transition hover:bg-white/10"
        >
          Keep browsing toys
        </Link>
      </div>
    </main>
  );
}
