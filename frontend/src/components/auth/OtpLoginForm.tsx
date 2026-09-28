'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import api from '../../lib/api';
import { useAuthStore, type AuthUser } from '../../store/useAuthStore';

const PHONE_REGEX = /^09[0-9]{9}$/;
const OTP_REGEX = /^[0-9]{5}$/;
const COUNTDOWN = 120;

function errMsg(e: unknown, fb: string): string {
  if (axios.isAxiosError(e)) {
    const d = e.response?.data as { message?: string } | undefined;
    if (d?.message) return d.message;
    if (e.response?.status === 429)
      return 'درخواست بیش از حد مجاز است. کمی بعد تلاش کنید.';
  }
  return fb;
}

export default function OtpLoginForm() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [left, setLeft] = useState(COUNTDOWN);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);
  const start = useCallback(() => {
    stop();
    setLeft(COUNTDOWN);
    timer.current = setInterval(() => {
      setLeft((p) => {
        if (p <= 1) { stop(); return 0; }
        return p - 1;
      });
    }, 1000);
  }, [stop]);
  useEffect(() => () => stop(), [stop]);
  const fmt = (t: number) =>
    `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, '0')}`;

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null); setInfo(null);
    if (!PHONE_REGEX.test(phone)) {
      setError('شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم داشته باشد.');
      return;
    }
    setLoading(true);
    try {
      const r = await api.post('/auth/otp/send', { phone });
      setStep('code'); setCode(''); start();
      setInfo(r.data?.message ?? 'کد تأیید ارسال شد.');
    } catch (err) { setError(errMsg(err, 'ارسال کد ناموفق بود.')); }
    finally { setLoading(false); }
  };

  const verify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null); setInfo(null);
    if (!OTP_REGEX.test(code)) {
      setError('کد تأیید باید ۵ رقم عددی باشد.');
      return;
    }
    setLoading(true);
    try {
      const r = await api.post<{
        message: string;
        data: { user: AuthUser; token: string };
      }>('/auth/otp/verify', { phone, code });
      setAuth(r.data.data.user, r.data.data.token);
      router.push('/');
    } catch (err) { setError(errMsg(err, 'کد وارد شده معتبر نیست.')); }
    finally { setLoading(false); }
  };
  const resend = async () => {
    if (left > 0 || loading) return;
    await send();
  };

  return (
    <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6 shadow-block backdrop-blur">
      <h1 className="text-center text-xl font-black">ورود با پیامک</h1>
      <p className="mt-1 text-center text-sm text-white/60">
        {step === 'phone'
          ? 'شماره موبایل خود را وارد کنید تا کد تأیید ارسال شود.'
          : `کد ۵ رقمی ارسال شده به ${phone} را وارد کنید.`}
      </p>
      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-brick-500/40 bg-brick-500/15 px-3 py-2 text-sm text-brick-400">
          {error}
        </p>
      )}
      {info && !error && (
        <p role="status" className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-300">
          {info}
        </p>
      )}
      {step === 'phone' ? (
        <form onSubmit={send} className="mt-5 space-y-4" dir="ltr">
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="09123456789"
            value={phone}
            onChange={(e) => setPhone(e.target.value.trim())}
            maxLength={11}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center font-mono text-lg tracking-widest text-white placeholder:text-white/30 focus:border-sky-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-sky-500 px-4 py-3 font-bold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'در حال ارسال…' : 'ارسال کد تأیید'}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-5 space-y-4" dir="ltr">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="12345"
            value={code}
            onChange={(e) => setCode(e.target.value.trim())}
            maxLength={5}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] text-white placeholder:text-white/30 focus:border-sky-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-sky-500 px-4 py-3 font-bold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'در حال بررسی…' : 'تأیید و ورود'}
          </button>
          <div className="flex items-center justify-between text-sm text-white/60" dir="rtl">
            {left > 0 ? (
              <span className="font-mono" dir="ltr">{fmt(left)}</span>
            ) : (
              <span>کدی دریافت نکردید؟</span>
            )}
            <button
              type="button"
              onClick={resend}
              disabled={left > 0 || loading}
              className="font-bold text-sky-400 hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
            >
              ارسال مجدد
            </button>
          </div>
          <button
            type="button"
            onClick={() => { stop(); setStep('phone'); setError(null); setInfo(null); }}
            className="w-full text-center text-sm text-white/50 hover:text-white/80"
          >
            تغییر شماره موبایل
          </button>
        </form>
      )}
    </div>
  );
}
