import type { Metadata } from 'next';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import Card from '@/src/components/ui/Card';
import Container from '@/src/components/ui/Container';

export const metadata: Metadata = {
  title: 'تماس با ما | Toy Store',
  description: 'راه‌های تماس با پشتیبانی فروشگاه Toy Store.',
};

/**
 * Contact details.
 *
 * PLACEHOLDER: these are deliberately obviously-fake values. The owner replaces
 * them (or swaps this block for a real contact endpoint) — nothing else on the
 * page has to change.
 */
const CONTACT_ROWS = [
  { label: 'تلفن پشتیبانی', value: '۰۲۱-۰۰۰۰۰۰۰۰' },
  { label: 'واتس‌اپ', value: '۰۹۱۲۰۰۰۰۰۰۰' },
  { label: 'ایمیل', value: 'support@toystore.example' },
  { label: 'ساعت پاسخگویی', value: 'شنبه تا چهارشنبه، ۹ تا ۱۸' },
];

export default function ContactPage() {
  return (
    <Container className="py-8">
      <Breadcrumbs items={[{ label: 'تماس با ما' }]} />

      <div className="mt-6 max-w-3xl space-y-5">
        <h1 className="font-display text-3xl text-ink">تماس با ما</h1>

        <p className="text-sm leading-8 text-ink/70">
          برای پیگیری سفارش، پرسش درباره محصولات یا بازگشت کالا، از یکی از راه‌های
          زیر با ما در تماس باشید. کارشناسان پشتیبانی در اولین فرصت پاسخ
          می‌دهند.
        </p>
      </div>

      <Card className="mt-8 max-w-xl p-6">
        <dl className="divide-y divide-ink/10">
          {CONTACT_ROWS.map((row) => (
            <div key={row.label} className="flex justify-between gap-4 py-3">
              <dt className="text-ink/60">{row.label}</dt>
              <dd className="text-end font-bold text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 text-xs text-ink/50">
          نکته: اطلاعات بالا نمونه است و پیش از انتشار باید با اطلاعات واقعی
          فروشگاه جایگزین شود.
        </p>
      </Card>
    </Container>
  );
}
