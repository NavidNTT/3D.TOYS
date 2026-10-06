import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import Card from '@/src/components/ui/Card';
import Container from '@/src/components/ui/Container';

export const metadata: Metadata = {
  title: 'درباره ما | Toy Store',
  description:
    'Toy Store فروشگاه اسباب‌بازی با پیش‌نمایش سه‌بعدی؛ هر محصول را پیش از خرید بچرخانید و از نزدیک ببینید.',
};

const HIGHLIGHTS = [
  {
    icon: '🧸',
    title: 'دیدن، چرخاندن، خریدن',
    body: 'برای هر محصول یک مدل سه‌بعدی آماده شده است تا پیش از خرید از هر زاویه بررسی‌اش کنید.',
  },
  {
    icon: '✅',
    title: 'کالای اصل',
    body: 'همه محصولات از فروشندگان معتبر تأمین و با تأییدیه سلامت و ایمنی عرضه می‌شوند.',
  },
  {
    icon: '↩️',
    title: 'بازگشت آسوده',
    body: 'تا ۷ روز پس از دریافت، در صورت سالم بودن بسته‌بندی امکان بازگشت کالا وجود دارد.',
  },
];

export default function AboutPage() {
  return (
    <Container className="py-8">
      <Breadcrumbs items={[{ label: 'درباره ما' }]} />

      <div className="mt-6 max-w-3xl space-y-5">
        <h1 className="font-display text-3xl text-ink">درباره Toy Store</h1>

        <p className="text-sm leading-8 text-ink/70">
          Toy Store یک فروشگاه اسباب‌بازی است که خرید را از حدس زدن درمی‌آورد.
          برای هر محصول یک مدل سه‌بعدی آماده کرده‌ایم تا بتوانید آن را بچرخانید،
          از نزدیک ببینید و با اطمینان انتخاب کنید — درست همان چیزی را می‌خرید که
          روی صفحه می‌بینید.
        </p>

        <p className="text-sm leading-8 text-ink/70">
          تمرکز ما روی کالای اصل، ارسال سریع و پشتیبانی ساده و صادقانه است. اگر
          پرسشی دارید، از صفحه تماس با ما در میان بگذارید.
        </p>
      </div>

      <ul className="mt-10 grid gap-4 sm:grid-cols-3">
        {HIGHLIGHTS.map((item) => (
          <li key={item.title}>
            <Card className="h-full p-5">
              <span aria-hidden className="text-2xl">
                {item.icon}
              </span>
              <h2 className="mt-2 font-display text-lg text-ink">
                {item.title}
              </h2>
              <p className="mt-1 text-sm leading-6 text-ink/60">{item.body}</p>
            </Card>
          </li>
        ))}
      </ul>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/categories"
          className="rounded-md bg-brand-500 px-5 py-3 text-sm font-bold text-white shadow-card transition hover:bg-brand-600"
        >
          مشاهده دسته‌بندی‌ها
        </Link>
        <Link
          href="/contact"
          className="rounded-md border border-ink/15 bg-surface px-5 py-3 text-sm font-bold text-ink/80 transition hover:bg-cream-100"
        >
          تماس با ما
        </Link>
      </div>
    </Container>
  );
}
