import type { Metadata } from 'next';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import Card from '@/src/components/ui/Card';
import Container from '@/src/components/ui/Container';

export const metadata: Metadata = {
  title: 'قوانین و بازگشت کالا | Toy Store',
  description: 'شرایط بازگشت و تعویض کالا در فروشگاه Toy Store.',
};

const CONDITIONS = [
  'کالا در مدت ۷ روز پس از دریافت، به فروشگاه اطلاع داده شده باشد.',
  'بسته‌بندی و همه ملحقات و لوازم جانبی کالا سالم و کامل باشد.',
  'کالا استفاده نشده و در وضعیت اولیه تحویل باشد.',
  'فاکتور خرید یا شماره سفارش ارائه شود.',
];

const EXCLUSIONS = [
  'کالاهای بهداشتی و شخصی‌سازی‌شده.',
  'کالاهایی که با دخل در بسته‌بندی یا استفاده، قابل فروش مجدد نباشند.',
];

export default function ReturnsPage() {
  return (
    <Container className="py-8">
      <Breadcrumbs items={[{ label: 'قوانین و بازگشت کالا' }]} />

      <div className="mt-6 max-w-3xl space-y-5">
        <h1 className="font-display text-3xl text-ink">
          قوانین و بازگشت کالا
        </h1>

        <p className="text-sm leading-8 text-ink/70">
          اگر کالا به هر دلیل مطابق انتظار شما نبود، تا ۷ روز پس از دریافت
          امکان بازگشت آن وجود دارد؛ به شرطی که شرایط زیر رعایت شده باشد.
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-display text-xl text-ink">شرایط پذیرش</h2>
          <ul className="mt-3 space-y-2 text-sm leading-7 text-ink/70">
            {CONDITIONS.map((condition) => (
              <li key={condition} className="flex gap-2">
                <span aria-hidden className="text-emerald-600">
                  ✓
                </span>
                <span>{condition}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-xl text-ink">استثنائات</h2>
          <ul className="mt-3 space-y-2 text-sm leading-7 text-ink/70">
            {EXCLUSIONS.map((exclusion) => (
              <li key={exclusion} className="flex gap-2">
                <span aria-hidden className="text-red-600">
                  ✕
                </span>
                <span>{exclusion}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h2 className="font-display text-xl text-ink">مراحل بازگشت</h2>
          <ol className="mt-3 list-inside list-decimal space-y-2 text-sm leading-7 text-ink/70">
            <li>از صفحه تماس با ما، درخواست بازگشت را اعلام کنید.</li>
            <li>کارشناسان ما کالا و شرایط آن را بررسی و تأیید می‌کنند.</li>
            <li>
              کالا پس از هماهنگی، به نشانی اعلامی فروشگاه ارسال می‌شود.
            </li>
            <li>
              پس از تأیید سلامت کالا، فرایند بازپرداخت وجه آغاز می‌شود.
            </li>
          </ol>
        </Card>
      </div>
    </Container>
  );
}
