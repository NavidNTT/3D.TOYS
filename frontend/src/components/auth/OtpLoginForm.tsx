'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/src/components/ui/Button';
import Card from '@/src/components/ui/Card';
import Input from '@/src/components/ui/Input';
import { isValidIranianPhone, normalizePhone, toAsciiDigits } from '@/src/lib/persian';

/**
 * Passwordless (OTP) sign-in form.
 *
 * Two steps: request a code, then verify it. Both calls hit Next.js route
 * handlers rather than Laravel directly, so the Sanctum token that comes back
 * is written straight into an httpOnly cookie by the server — page JavaScript
 * never sees it. The API's own Persian message (including the rate-limit text
 * that says how long to wait) is shown verbatim.
 */
export default function OtpLoginForm({ next }: { next: string }) {
  const router = useRouter();

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const requestOtp = async () => {
    const normalized = normalizePhone(phone);

    if (!isValidIranianPhone(normalized)) {
      setError('شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم داشته باشد.');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalized }),
      });

      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
      } | null;

      if (!response.ok || !payload?.success) {
        setError(payload?.message ?? 'ارسال کد تأیید ناموفق بود. دوباره تلاش کنید.');
        return;
      }

      setPhone(normalized);
      setStep('code');
      setNotice('کد تأیید برای شماره شما ارسال شد.');
      setCode('');
    } catch {
      setError('ارتباط با سرور برقرار نشد. لطفاً چند لحظه بعد دوباره تلاش کنید.');
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    const digits = toAsciiDigits(code).replace(/\D/g, '');

    if (digits.length !== 5) {
      setError('کد تأیید باید ۵ رقم باشد.');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: digits }),
      });

      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
      } | null;

      if (!response.ok || !payload?.success) {
        setError(payload?.message ?? 'ورود ناموفق بود. کد را بررسی کنید.');
        return;
      }

      // Land the customer back where they were, then re-render the server
      // components (header, /orders) as a signed-in visitor.
      router.push(next);
      router.refresh();
    } catch {
      setError('ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mx-auto max-w-md p-6 sm:p-8">
      <div className="space-y-6">
        <div className="space-y-3 text-center">
          <span className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-black text-brand-600">
            {step === 'phone' ? 'مرحله ۱ از ۲ — شماره موبایل' : 'مرحله ۲ از ۲ — کد تأیید'}
          </span>
          <h2 className="font-display text-2xl text-ink">
            {step === 'phone' ? 'شماره موبایل خود را وارد کنید' : 'کد تأیید را وارد کنید'}
          </h2>
          <p className="text-sm leading-6 text-ink/60">
            {step === 'phone'
              ? 'برای ادامه، شماره موبایل حساب خود را وارد کنید تا کد تأیید برایتان پیامک شود.'
              : `کد پنج‌رقمی ارسال‌شده به ${phone} را وارد کنید.`}
          </p>
        </div>

        {notice && step === 'code' && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold leading-6 text-emerald-800"
          >
            <span aria-hidden="true" className="mt-0.5 font-black">
              ✓
            </span>
            <span>{notice}</span>
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold leading-6 text-red-700"
          >
            <span aria-hidden="true" className="mt-0.5 font-black">
              !
            </span>
            <span>{error}</span>
          </p>
        )}

        {step === 'phone' ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void requestOtp();
            }}
          >
            <Input
              id="otp-phone"
              label="شماره موبایل"
              hint="مثال: ۰۹۱۲۳۴۵۶۷۸۹"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              dir="ltr"
              placeholder="09123456789"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
            />

            <Button type="submit" size="lg" loading={busy} className="w-full">
              ارسال کد تأیید
            </Button>
          </form>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void verifyOtp();
            }}
          >
            <Input
              id="otp-code"
              label="کد تأیید"
              hint="کد ۵ رقمی پیامک‌شده را وارد کنید."
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              maxLength={5}
              placeholder="۱۲۳۴۵"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
            />

            <Button type="submit" size="lg" loading={busy} className="w-full">
              ورود
            </Button>

            <button
              type="button"
              onClick={() => {
                setStep('phone');
                setCode('');
                setError(null);
                setNotice(null);
              }}
              disabled={busy}
              className="w-full rounded-lg py-2 text-sm font-bold text-ink/70 transition hover:bg-cream-100 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50"
            >
              ویرایش شماره موبایل
            </button>
          </form>
        )}
      </div>
    </Card>
  );
}
