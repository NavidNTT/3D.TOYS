'use client';

import { useState } from 'react';
import Link from 'next/link';
import api from '@/src/lib/api';
import { useMounted } from '@/src/lib/useMounted';
import { useAuthStore } from '@/src/store/useAuthStore';
import { selectTotalItems, useCartStore } from '@/src/store/useCartStore';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/#catalog', label: 'Catalog' },
  { href: '/products/sample', label: '3D demo' },
  { href: '/status', label: 'Status' },
];

/**
 * Sticky application header.
 *
 * Both the cart count and the auth state come from persisted stores, so they are
 * gated on `mounted`: the server HTML always renders the signed-out, zero-item
 * shape and the client swaps it in after hydration.
 */
export default function Header() {
  const mounted = useMounted();
  const items = useCartStore((state) => state.items);
  const openDrawer = useCartStore((state) => state.openDrawer);
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [loggingOut, setLoggingOut] = useState(false);

  const count = mounted ? selectTotalItems(items) : 0;
  const authed = mounted && isAuthenticated;

  const logout = async () => {
    setLoggingOut(true);
    try {
      await api.post('/auth/logout');
    } catch {
      // The token may already be expired or revoked — clearing it locally is
      // the outcome the user asked for either way.
    } finally {
      clearAuth();
      setLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0b1020]/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-black">
          <span
            aria-hidden
            className="grid h-9 w-9 place-items-center rounded-xl bg-sky-500 font-mono text-xs"
          >
            3D
          </span>
          <span className="hidden sm:inline">Toy Store</span>
        </Link>

        <nav className="hidden items-center gap-1 text-sm text-white/70 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 transition hover:bg-white/10 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-2">
          {/* Auth status. The signed-out shape is rendered on the server and on
              the first client render, so they always agree; a persisted user
              only appears after hydration. */}
          {authed && user ? (
            <>
              <span
                className="hidden max-w-[12rem] truncate text-sm text-white/60 sm:inline"
                title={user.name ?? user.phone}
              >
                {user.name ?? user.phone}
              </span>
              <Link
                href="/orders"
                className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                سفارش‌های من 📦
              </Link>
              <button
                type="button"
                onClick={logout}
                disabled={loggingOut}
                className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                {loggingOut ? 'Signing out…' : 'Logout'}
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
            >
              Login
            </Link>
          )}

          <button
            type="button"
            onClick={openDrawer}
            aria-label={`Open cart, ${count} items`}
            className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-white/5 text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden
              className="h-5 w-5"
            >
              <path
                d="M3 4h2l2.4 10.2a2 2 0 0 0 2 1.55h7.4a2 2 0 0 0 1.95-1.55L20.5 7H6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="9.5" cy="19.5" r="1.4" />
              <circle cx="17.5" cy="19.5" r="1.4" />
            </svg>

            {count > 0 && (
              <span className="absolute -top-1 -end-1 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-brick-500 px-1 text-[11px] font-bold text-white">
                {count}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
