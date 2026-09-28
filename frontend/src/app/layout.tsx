import type { Metadata } from 'next';
import CartDrawer from '@/src/components/cart/CartDrawer';
import Header from '@/src/components/layout/Header';
import './globals.css';

export const metadata: Metadata = {
  title: 'Toy Store — 3D playground',
  description:
    'High-performance 3D toy store: Laravel API + Next.js App Router + MinIO asset pipeline.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `dir="rtl"` for the Iranian storefront (fa-IR prices, Persian SMS copy).
    // `lang` stays "en" because the visible UI copy is still English; switch it
    // to "fa" in the same commit that localises the strings, or screen readers
    // will mis-pronounce both.
    <html lang="en" dir="rtl">
      <body className="min-h-screen antialiased">
        <Header />
        <CartDrawer />
        {children}
      </body>
    </html>
  );
}
