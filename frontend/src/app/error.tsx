'use client';

import Link from 'next/link';

/**
 * Root error boundary.
 *
 * `error.tsx` must be a client component — it is the only place Next hands a
 * thrown server error to. Copy stays warm and Persian; the technical digest is
 * exposed only as a title attribute, so a shopper never has to read one.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-20 text-center sm:px-6">
      <p className="text-6xl" aria-hidden>
        🫠
      </p>

      <h1 className="mt-6 font-display text-4xl text-ink">
        یک مشکل پیش آمد
      </h1>

      <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-ink/60">
        چیزی درست پیش نرفت. چند لحظه بعد دوباره تلاش کنید؛ اگر ادامه داشت، از
        خانه شروع کنید.
      </p>

      {error.digest && (
        <p className="mt-2 text-xs text-ink/40" title={error.digest}>
          کد پیگیری: {error.digest}
        </p>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-brand-500 px-6 py-3 text-sm font-bold text-white shadow-card transition hover:bg-brand-600"
        >
          تلاش دوباره
        </button>
        <Link
          href="/"
          className="rounded-md border border-ink/15 bg-surface px-6 py-3 text-sm font-bold text-ink/80 transition hover:bg-cream-100"
        >
          بازگشت به خانه
        </Link>
      </div>
    </div>
  );
}
