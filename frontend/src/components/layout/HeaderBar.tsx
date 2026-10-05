'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMounted } from '@/src/lib/useMounted';
import type { SessionUser } from '@/src/lib/auth/session';
import { selectTotalItems, useCartStore } from '@/src/store/useCartStore';
import { SEARCH_OPEN_EVENT } from '@/src/lib/searchEvents';

/**
 * Interactive header bar.
 *
 * RTL-first, light warm theme. The auth decision is *not* made here — the
 * server already resolved it and hands `user` (or null) down as a prop, so
 * there is no "signed in after hydration" flicker. Only genuinely client-side
 * state (the persisted cart count, the logout request) lives here.
 */

const NAV_LINKS = [
  { href: '/categories', label: 'دسته‌بندی‌ها' },
  { href: '/about', label: 'درباره ما' },
];

const LINK_CLASS =
  'rounded-md px-3 py-2 text-sm font-bold text-ink/70 transition hover:bg-cream-100 hover:text-ink';

export default function HeaderBar({ user }: { user: SessionUser | null }) {
  const mounted = useMounted();
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const [loggingOut, setLoggingOut] = useState(false);

  // Before hydration the cart is always empty, so the server HTML and the first
  // client render agree; the count fills in afterwards.
  const cartCount = mounted ? selectTotalItems(items) : 0;

  const openSearch = () => window.dispatchEvent(new Event(SEARCH_OPEN_EVENT));

  const logout = async () => {
    setLoggingOut(true);

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Clearing the cookie is the outcome the user asked for; the route also
      // clears it when the API is unreachable, so a failure here is harmless.
    } finally {
      setLoggingOut(false);
      // Re-render server components (e.g. /orders) as a signed-out visitor.
      router.refresh();
      router.push('/');
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-ink/10 bg-cream-50/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2"
          aria-label="صفحه اصلی توی استور"
        >
          <span
            aria-hidden
            className="grid h-9 w-9 place-items-center rounded-md bg-brand-500 font-display text-sm text-white shadow-card"
          >
            3D
          </span>
          <span className="font-display text-xl leading-none text-ink">
            Toy&nbsp;Store
          </span>
        </Link>

        <nav aria-label="ناوبری اصلی" className="hidden items-center gap-1 md:flex">
          <Link href="/" className={LINK_CLASS}>
            خانه
          </Link>
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={LINK_CLASS}>
              {link.label}
            </Link>
          ))}
          <button type="button" onClick={openSearch} className={LINK_CLASS}>
            جستجو
          </button>
        </nav>

        <div className="ms-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={openSearch}
            aria-label="جستجو در محصولات"
            className="grid h-10 w-10 place-items-center rounded-md border border-ink/15 bg-surface text-ink/70 transition hover:bg-cream-100 hover:text-ink md:hidden"
          >
            <SearchIcon />
          </button>

          {user ? (
            <>
              <Link
                href="/orders"
                className="hidden rounded-md px-3 py-2 text-sm font-bold text-ink/70 transition hover:bg-cream-100 hover:text-ink sm:inline-block"
              >
                سفارش‌های من
              </Link>
              <span
                className="hidden max-w-[10rem] truncate text-xs text-ink/50 lg:inline"
                title={user.name ?? user.phone}
              >
                {user.name ?? user.phone}
              </span>
              <button
                type="button"
                onClick={logout}
                disabled={loggingOut}
                className="rounded-md border border-ink/15 bg-surface px-3 py-2 text-sm font-bold text-ink/80 transition hover:bg-cream-100 disabled:opacity-50"
              >
                {loggingOut ? 'خروج…' : 'خروج'}
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md border border-ink/15 bg-surface px-3 py-2 text-sm font-bold text-ink/80 transition hover:bg-cream-100"
            >
              ورود
            </Link>
          )}

          <Link
            href="/cart"
            aria-label={`سبد خرید، ${cartCount} کالا`}
            className="relative grid h-10 w-10 place-items-center rounded-md border border-ink/15 bg-surface text-ink/80 transition hover:bg-cream-100"
          >
            <CartIcon />
            {cartCount > 0 && (
              <span className="tnum absolute -top-1.5 -end-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand-500 px-1 text-[11px] font-bold text-white">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden
      className="h-5 w-5"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden
      className="h-5 w-5"
    >
      <path
        d="M3 4h2l2.4 10.2a2 2 0 0 0 1.95 1.55h7.4a2 2 0 0 0 1.95-1.55L20.5 7H6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9.5" cy="19.5" r="1.4" />
      <circle cx="17.5" cy="19.5" r="1.4" />
    </svg>
  );
}

