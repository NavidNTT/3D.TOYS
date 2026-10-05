import localFont from 'next/font/local';
import type { Metadata } from 'next';
import Footer from '@/src/components/layout/Footer';
import Header from '@/src/components/layout/Header';
import './globals.css';

/**
 * Vazirmatn — body font, self-hosted.
 *
 * Two unicode-range slices from the same release: the arabic slice carries the
 * Persian glyphs (U+0600–06FF et al.), the latin slice the product names and
 * technical strings in English. next/font inlines both @font-face rules and the
 * browser picks per codepoint, so Persian text never falls back to a system
 * font while English keeps its own metrics.
 */
const vazirmatn = localFont({
  variable: '--font-vazirmatn',
  display: 'swap',
  src: [
    {
      path: './fonts/vazirmatn-arabic-400.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/vazirmatn-latin-400.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/vazirmatn-arabic-500.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: './fonts/vazirmatn-latin-500.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: './fonts/vazirmatn-arabic-700.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: './fonts/vazirmatn-latin-700.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
});

/**
 * Lalezar — display font for headings and the wordmark.
 *
 * Single weight by design (Lalezar ships only 400); headings get their presence
 * from size, not weight. Same arabic/latin slice split as the body font.
 */
const lalezar = localFont({
  variable: '--font-lalezar',
  display: 'swap',
  src: [
    {
      path: './fonts/lalezar-arabic-400.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/lalezar-latin-400.woff2',
      weight: '400',
      style: 'normal',
    },
  ],
});

export const metadata: Metadata = {
  title: 'Toy Store — فروشگاه اسباب‌بازی',
  description: 'فروشگاه اسباب‌بازی با پیش‌نمایش سه‌بعدی: دیدن، چرخاندن و خرید اسباب‌بازی‌ها.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={`${vazirmatn.variable} ${lalezar.variable}`}>
      <body className="flex min-h-screen flex-col bg-cream-50 font-body text-ink antialiased">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
