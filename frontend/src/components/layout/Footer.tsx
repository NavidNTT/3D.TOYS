import Link from 'next/link';
import Container from '@/src/components/ui/Container';
import { FOOTER_QUICK_LINKS } from '@/src/lib/catalog';

/**
 * Site footer (server component — static links only).
 *
 * The trust-badge slot is deliberately an empty, clearly marked placeholder:
 * the owner drops in the Enamad/نماد markup there once the store is registered,
 * and nothing else has to change.
 *
 * The quick links live in src/lib/catalog.ts. This block is the only navigation
 * a phone sees — the header collapses its menu on small screens — so the link to
 * the full catalog has to be here, not just in the header.
 */

export default function Footer() {
  return (
    <footer className="relative mt-16 overflow-hidden border-t border-ink/10 bg-cream-100">
      <div
        aria-hidden
        className="pointer-events-none absolute -start-20 -top-24 h-56 w-56 rounded-full bg-toy-lime/35 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 end-0 h-56 w-56 rounded-full bg-brand-500/10 blur-3xl"
      />

      <Container className="relative grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8 lg:py-16">
        <div className="space-y-4 sm:col-span-2 lg:col-span-5">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500"
            aria-label="صفحه اصلی 3D.TOYS"
          >
            <span
              aria-hidden
              className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 text-white shadow-[0_3px_0_#1939A8]"
            >
              <BrandCubeIcon />
            </span>
            <span className="font-display text-2xl leading-none text-ink">
              3D<span className="text-toy-orange">.</span>TOYS
            </span>
          </Link>

          <p className="max-w-sm text-sm leading-7 text-ink/65">
            فروشگاه اسباب‌بازی با پیش‌نمایش سه‌بعدی؛ هر اسباب‌بازی را پیش از خرید
            بچرخانید و از نزدیک ببینید.
          </p>

          <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/15 bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            دیدن، چرخاندن، انتخاب
          </span>
        </div>

        <nav aria-label="پیوندهای پانویس" className="space-y-3 lg:col-span-4">
          <h2 className="text-sm font-bold text-ink">دسترسی سریع</h2>
          <ul className="space-y-1 text-sm text-ink/65">
            {FOOTER_QUICK_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="group inline-flex items-center gap-2 rounded-md py-1 transition hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                >
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-full bg-ink/20 transition group-hover:bg-toy-orange"
                  />
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-3 lg:col-span-3">
          <h2 className="text-sm font-bold text-ink">نماد اعتماد</h2>
          {/* PLACEHOLDER: Enamad / نماد trust badge goes here. */}
          <div className="grid h-24 w-24 place-items-center rounded-2xl border border-dashed border-ink/20 bg-surface/60 text-center text-[11px] leading-5 text-ink/45">
            نماد
            <br />
            اعتماد
          </div>
          <p className="max-w-[13rem] text-xs leading-5 text-ink/50">
            جایگاه نماد رسمی فروشگاه.
          </p>
        </div>
      </Container>

      <div className="relative border-t border-ink/10 py-5">
        <Container className="flex flex-col items-center justify-between gap-2 text-center text-xs text-ink/50 sm:flex-row sm:text-start">
          <p>
            © {new Date().getFullYear()} 3D.TOYS — همه حقوق محفوظ است.
          </p>
          <p className="font-bold text-ink/45">3D.TOYS · فروشگاه اسباب‌بازی</p>
        </Container>
      </div>
    </footer>
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
