'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatPriceFa } from '@/src/lib/format';
import { useMounted } from '@/src/lib/useMounted';
import {
  selectTotalItems,
  selectTotalPrice,
  useCartStore,
} from '@/src/store/useCartStore';

/**
 * Sliding cart drawer.
 *
 * Positioning is logical (`end-0`, `border-s`) with a `rtl:` transform variant,
 * so the panel always slides in from the inline-end edge — the right in LTR,
 * the left in RTL — without maintaining two sets of classes.
 */
export default function CartDrawer() {
  const mounted = useMounted();
  const isOpen = useCartStore((state) => state.isDrawerOpen);
  const items = useCartStore((state) => state.items);
  const closeDrawer = useCartStore((state) => state.closeDrawer);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const clearCart = useCartStore((state) => state.clearCart);

  // The persisted cart rehydrates before the first client render, so the open
  // state is only honoured once mounted — otherwise the server HTML (closed)
  // and the client HTML (open) would disagree.
  const open = mounted && isOpen;

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDrawer();
    };

    document.addEventListener('keydown', onKeyDown);

    // Freeze the page behind the drawer, then restore whatever was there.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, closeDrawer]);

  const count = selectTotalItems(items);
  const total = selectTotalPrice(items);
  // Every line is priced in the currency the API returned; a mixed-currency
  // cart is summed as-is (a storefront order settles in one currency).
  const currency = items[0]?.currency ?? null;

  return (
    <>
      <div
        aria-hidden
        onClick={closeDrawer}
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        aria-hidden={!open}
        className={`fixed inset-y-0 end-0 z-50 flex w-full max-w-md flex-col border-s border-white/10 bg-[#0b1020] shadow-2xl transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full rtl:-translate-x-full'
        }`}
      >
        {/*
          Everything inside the shell mounts only while open. The shell itself
          stays in the DOM so the slide transition can play, but a closed drawer
          therefore exposes nothing focusable — and is hidden from assistive
          tech, since an empty aria-modal dialog would otherwise trap attention.
        */}
        {open && (
          <>
            <header className="flex items-center justify-between gap-3 border-b border-white/10 p-5">
              <h2 className="text-lg font-black">
                Your cart
                {count > 0 && (
                  <span className="ms-2 text-sm font-bold text-white/50">
                    ({count})
                  </span>
                )}
              </h2>
              <button
                type="button"
                onClick={closeDrawer}
                aria-label="Close cart"
                className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                ×
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5">
              {items.length === 0 ? (
                <p className="pt-12 text-center text-sm text-white/50">
                  Your cart is empty.
                </p>
              ) : (
                <ul className="space-y-5">
                  {items.map((item) => (
                    <li key={item.productId} className="flex gap-4">
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                        {item.thumbnailUrl ? (
                          <Image
                            src={item.thumbnailUrl}
                            alt={item.name}
                            width={80}
                            height={80}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="grid h-full w-full place-items-center font-mono text-xs text-white/30">
                            3D
                          </span>
                        )}
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <Link
                          href={`/products/${item.slug}`}
                          onClick={closeDrawer}
                          className="line-clamp-2 text-sm font-bold transition hover:text-sky-400"
                        >
                          {item.name}
                        </Link>

                        <p className="text-sm font-black text-sky-400">
                          {formatPriceFa(
                            item.price * item.quantity,
                            item.currency,
                          )}
                        </p>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center rounded-xl border border-white/15">
                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(item.productId, item.quantity - 1)
                              }
                              aria-label={`Decrease quantity of ${item.name}`}
                              className="h-8 w-8 text-lg leading-none text-white/70 transition hover:bg-white/10 hover:text-white"
                            >
                              −
                            </button>
                            <span className="w-8 text-center text-sm font-bold">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(item.productId, item.quantity + 1)
                              }
                              aria-label={`Increase quantity of ${item.name}`}
                              className="h-8 w-8 text-lg leading-none text-white/70 transition hover:bg-white/10 hover:text-white"
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeItem(item.productId)}
                            className="text-xs text-brick-400 transition hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {items.length > 0 && (
              <footer className="space-y-3 border-t border-white/10 p-5">
                <div className="flex items-center justify-between text-sm text-white/60">
                  <span>Items</span>
                  <span>{count}</span>
                </div>
                <div className="flex items-center justify-between text-lg font-black">
                  <span>Total</span>
                  <span className="text-sky-400">
                    {formatPriceFa(total, currency)}
                  </span>
                </div>
                <p className="text-xs text-white/40">
                  Shipping and taxes are calculated at checkout.
                </p>

                <Link
                  href="/checkout"
                  onClick={closeDrawer}
                  className="block w-full rounded-xl bg-sky-500 px-4 py-3 text-center font-bold text-white shadow-block transition hover:bg-sky-600"
                >
                  Checkout
                </Link>

                <button
                  type="button"
                  onClick={clearCart}
                  className="w-full text-xs text-white/40 transition hover:text-brick-400"
                >
                  Clear cart
                </button>
              </footer>
            )}

          </>
        )}
      </aside>
    </>
  );
}
