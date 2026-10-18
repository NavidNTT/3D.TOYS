'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { HEADER_NAV_LINKS } from '@/src/lib/catalog';
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

// The primary navigation lives in src/lib/catalog.ts: the catalog link has to be
// reachable from the header, the footer and the home page, and three copies of a
// link list is three chances for one of them to go stale.

const FOCUS_CLASS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

const NAV_LINK_CLASS =
  `inline-flex items-center rounded-full px-3.5 py-2 text-sm font-bold text-ink/70 transition hover:bg-surface hover:text-ink ${FOCUS_CLASS}`;

const ICON_BUTTON_CLASS =
  `grid h-10 w-10 place-items-center rounded-full border border-ink/10 bg-surface text-ink/70 shadow-card transition hover:border-ink/20 hover:bg-cream-100 hover:text-ink ${FOCUS_CLASS}`;

const ACCOUNT_LINK_CLASS =
  `inline-flex items-center justify-center rounded-full border border-ink/10 bg-surface px-3 py-2 text-sm font-bold text-ink/80 shadow-card transition hover:border-ink/20 hover:bg-cream-100 hover:text-ink ${FOCUS_CLASS}`;

export default function HeaderBar({ user }: { user: SessionUser | null }) {
  const mounted = useMounted();
  const pathname = usePathname();
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const [loggingOut, setLoggingOut] = useState(false);

  // Before hydration the cart is always empty, so the server HTML and the first
  // client render agree; the count fills in afterwards.
  const cartCount = mounted ? selectTotalItems(items) : 0;

  const openSearch = () => window.dispatchEvent(new Event(SEARCH_OPEN_EVENT));

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

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
    <header className="sticky top-0 z-30 border-b border-ink/10 bg-cream-50/90 shadow-[0_1px_0_rgb(255_255_255/0.7)] backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center gap-3 px-4 py-2.5 sm:min-h-[4.5rem] sm:px-6 lg:gap-5">
        <Link
          href="/"
          className={`group flex shrink-0 items-center gap-2.5 rounded-lg ${FOCUS_CLASS}`}
          aria-label="صفحه اصلی 3D.TOYS"
        >
          <span
            aria-hidden
            className="grid h-10 w-10 place-items-center rounded-[0.9rem] bg-brand-500 text-white shadow-[0_3px_0_#1939A8] transition group-hover:-translate-y-0.5 group-hover:bg-brand-600"
          >
            <BrandCubeIcon />
          </span>
          <span className="font-display text-xl leading-none text-ink sm:text-2xl">
            3D<span className="text-toy-orange">.</span>TOYS
          </span>
        </Link>

        <nav
          aria-label="ناوبری اصلی"
          className="ms-2 hidden items-center gap-0.5 rounded-full border border-ink/10 bg-cream-100/80 p-1 lg:flex"
        >
          {HEADER_NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? 'page' : undefined}
              className={`${NAV_LINK_CLASS} ${
                isActive(link.href)
                  ? 'bg-surface text-brand-700 shadow-card'
                  : ''
              }`}
            >
              {link.label}
            </Link>
          ))}
          <button type="button" onClick={openSearch} className={NAV_LINK_CLASS}>
            جستجو
          </button>
        </nav>

        <div className="ms-auto flex items-center gap-2">
          <button
            type="button"
            onClick={openSearch}
            aria-label="جستجو در محصولات"
            className={`${ICON_BUTTON_CLASS} lg:hidden`}
          >
            <SearchIcon />
          </button>

          {user ? (
            <>
              <Link
                href="/orders"
                className={`hidden sm:inline-flex ${ACCOUNT_LINK_CLASS}`}
              >
                سفارش‌های من
              </Link>
              <span
                className="hidden max-w-[9rem] truncate text-xs font-bold text-ink/50 xl:inline"
                title={user.name ?? user.phone}
              >
                {user.name ?? user.phone}
              </span>
              <button
                type="button"
                onClick={logout}
                disabled={loggingOut}
                className={`${ACCOUNT_LINK_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {loggingOut ? 'خروج…' : 'خروج'}
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className={ACCOUNT_LINK_CLASS}
            >
              ورود
            </Link>
          )}

          <Link
            href="/cart"
            aria-label={`سبد خرید، ${cartCount} کالا`}
            className={`relative grid h-10 w-10 place-items-center rounded-full bg-brand-500 text-white shadow-[0_3px_0_#1939A8] transition hover:-translate-y-0.5 hover:bg-brand-600 ${FOCUS_CLASS}`}
          >
            <CartIcon />
            {cartCount > 0 && (
              <span className="tnum absolute -top-1.5 -end-1.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-cream-50 bg-toy-lime px-1 text-[10px] font-black leading-none text-ink">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}

function BrandCubeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      aria-hidden
      className="h-5 w-5"
    >
      <path
        d="m12 3 7.5 4.3v8.6L12 20.2l-7.5-4.3V7.3L12 3Z"
        strokeLinejoin="round"
      />
      <path d="m4.8 7.5 7.2 4.2 7.2-4.2M12 11.7v8.2" strokeLinejoin="round" />
    </svg>
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

