import Link from 'next/link';
import Container from '@/src/components/ui/Container';

/**
 * Site footer (server component — static links only).
 *
 * The trust-badge slot is deliberately an empty, clearly marked placeholder:
 * the owner drops in the Enamad/نماد markup there once the store is registered,
 * and nothing else has to change.
 */

const FOOTER_LINKS = [
  { href: '/about', label: 'درباره ما' },
  { href: '/contact', label: 'تماس با ما' },
  { href: '/returns', label: 'قوانین و بازگشت کالا' },
];

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-ink/10 bg-surface">
      <Container className="grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-3">
          <p className="font-display text-2xl text-ink">Toy Store</p>
          <p className="max-w-xs text-sm leading-6 text-ink/60">
            فروشگاه اسباب‌بازی با پیش‌نمایش سه‌بعدی؛ هر اسباب‌بازی را پیش از خرید
            بچرخانید و از نزدیک ببینید.
          </p>
        </div>

        <nav aria-label="پیوندهای پانویس" className="space-y-3">
          <p className="text-sm font-bold text-ink/80">دسترسی سریع</p>
          <ul className="space-y-2 text-sm text-ink/60">
            {FOOTER_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="transition hover:text-brand-600"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-3">
          <p className="text-sm font-bold text-ink/80">نماد اعتماد</p>
          {/* PLACEHOLDER: Enamad / نماد trust badge goes here. */}
          <div className="grid h-20 w-20 place-items-center rounded-md border border-dashed border-ink/20 text-center text-[10px] leading-4 text-ink/40">
            نماد
            <br />
            اعتماد
          </div>
        </div>
      </Container>

      <div className="border-t border-ink/10 py-5">
        <Container className="text-center text-xs text-ink/50">
          © {new Date().getFullYear()} Toy Store — همه حقوق محفوظ است.
        </Container>
      </div>
    </footer>
  );
}
