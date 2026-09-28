'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import api from '@/src/lib/api';
import { formatPriceFa } from '@/src/lib/format';
import { useMounted } from '@/src/lib/useMounted';
import { useAuthStore } from '@/src/store/useAuthStore';
import {
  selectTotalItems,
  selectTotalPrice,
  useCartStore,
} from '@/src/store/useCartStore';

/** Mirrors App\Support\IranianMobileNumber::PATTERN on the API. */
const MOBILE_PATTERN = /^09[0-9]{9}$/;

/** Iranian postal codes are exactly ten digits. */
const POSTAL_CODE_PATTERN = /^[0-9]{10}$/;

interface CheckoutForm {
  receiver_name: string;
  receiver_phone: string;
  province: string;
  city: string;
  address: string;
  postal_code: string;
  notes: string;
}

const EMPTY_FORM: CheckoutForm = {
  receiver_name: '',
  receiver_phone: '',
  province: '',
  city: '',
  address: '',
  postal_code: '',
  notes: '',
};

/** One message per field, flattened from Laravel's `{[field]: string[]}` shape. */
type FieldErrors = Record<string, string>;

function flattenErrors(payload: unknown): FieldErrors {
  if (payload === null || typeof payload !== 'object') return {};

  const flat: FieldErrors = {};

  for (const [field, messages] of Object.entries(payload)) {
    if (Array.isArray(messages) && typeof messages[0] === 'string') {
      flat[field] = messages[0];
    }
  }

  return flat;
}

/**
 * Client-side mirror of CheckoutRequest.
 *
 * The API validates again and remains the authority — this only avoids a round
 * trip and points at the offending field straight away.
 */
function validate(form: CheckoutForm): FieldErrors {
  const errors: FieldErrors = {};

  if (form.receiver_name.trim().length < 2) {
    errors.receiver_name = 'Enter the recipient’s full name.';
  }
  if (!MOBILE_PATTERN.test(form.receiver_phone.trim())) {
    errors.receiver_phone = 'Mobile number must start with 09 and be 11 digits.';
  }
  if (form.province.trim() === '') errors.province = 'Province is required.';
  if (form.city.trim() === '') errors.city = 'City is required.';
  if (form.address.trim().length < 10) {
    errors.address = 'Address must be at least 10 characters.';
  }
  if (!POSTAL_CODE_PATTERN.test(form.postal_code.trim())) {
    errors.postal_code = 'Postal code must be exactly 10 digits.';
  }

  return errors;
}

export default function CheckoutPage() {
  const router = useRouter();
  const mounted = useMounted();

  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const closeDrawer = useCartStore((state) => state.closeDrawer);

  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [form, setForm] = useState<CheckoutForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const authed = mounted && isAuthenticated;
  const count = selectTotalItems(items);
  const total = selectTotalPrice(items);
  const currency = items[0]?.currency ?? null;

  // Prefill from the signed-in account; the customer can still overwrite both.
  useEffect(() => {
    if (!authed || !user) return;

    setForm((previous) => ({
      ...previous,
      receiver_name: previous.receiver_name || (user.name ?? ''),
      receiver_phone: previous.receiver_phone || user.phone,
    }));
  }, [authed, user]);

  // Both stores are persisted, so they only exist after hydration; nothing is
  // rendered until `mounted` to keep the server and client markup identical.
  useEffect(() => {
    if (mounted && !isAuthenticated) router.replace('/login');
  }, [mounted, isAuthenticated, router]);

  const update =
    (field: keyof CheckoutForm) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { value } = event.target;

      setForm((previous) => ({ ...previous, [field]: value }));
      setErrors((previous) => {
        if (!previous[field]) return previous;

        const next = { ...previous };
        delete next[field];

        return next;
      });
    };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setErrors({});

    const clientErrors = validate(form);

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);

      return;
    }

    if (items.length === 0) {
      setError('Your cart is empty.');

      return;
    }

    setSubmitting(true);

    try {
      const response = await api.post('/orders/checkout', {
        receiver_name: form.receiver_name.trim(),
        receiver_phone: form.receiver_phone.trim(),
        province: form.province.trim(),
        city: form.city.trim(),
        address: form.address.trim(),
        postal_code: form.postal_code.trim(),
        notes: form.notes.trim() === '' ? null : form.notes.trim(),
        // Identities and quantities only: the API prices the order from its own
        // product rows, so nothing here can change what is charged.
        items: items.map((item) => ({
          product_id: item.productId,
          quantity: item.quantity,
        })),
      });

      const orderNumber = (
        response.data as { data?: { order_number?: string } } | undefined
      )?.data?.order_number;

      clearCart();
      closeDrawer();

      // `replace`, not `push`: going back must not land on a stale cart.
      router.replace(
        `/checkout/success?order_number=${encodeURIComponent(orderNumber ?? '')}`,
      );
    } catch (exception) {
      if (axios.isAxiosError(exception)) {
        const payload = exception.response?.data as
          | { message?: string; data?: unknown }
          | undefined;
        const details = payload?.data;

        // Domain failures (out of stock, unpublished) carry a `reason` and are
        // shown as one message; validation failures carry a field map.
        if (
          details !== null &&
          typeof details === 'object' &&
          !('reason' in details)
        ) {
          setErrors(flattenErrors(details));
        }

        setError(
          payload?.message ?? 'We could not place your order. Please try again.',
        );
      } else {
        setError('We could not place your order. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Persisted stores only exist after hydration.
  if (!mounted) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-6 py-24 text-center">
        <p className="text-sm text-white/50">Loading checkout…</p>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-6 py-24 text-center">
        <h1 className="text-2xl font-black">Sign in to complete your order</h1>
        <p className="text-sm text-white/60">
          Taking you to the login page…
        </p>
        <Link
          href="/login"
          className="rounded-xl bg-sky-500 px-5 py-3 font-bold text-white shadow-block transition hover:bg-sky-600"
        >
          Go to login
        </Link>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-6 py-24 text-center">
        <h1 className="text-2xl font-black">Your cart is empty</h1>
        <p className="text-sm text-white/60">
          Add a toy to your cart and come back to complete the order.
        </p>
        <Link
          href="/"
          className="rounded-xl bg-sky-500 px-5 py-3 font-bold text-white shadow-block transition hover:bg-sky-600"
        >
          Browse the catalog
        </Link>
      </main>
    );
  }

  // Cart-line errors (items.0.quantity …) belong next to the summary, not under
  // a shipping input.
  const itemErrors = Object.entries(errors).filter(([field]) =>
    field.startsWith('items.'),
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-black">Checkout</h1>
        <p className="text-sm text-white/60">
          {count} {count === 1 ? 'item' : 'items'} · the amount is calculated on
          our servers when you submit.
        </p>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <form
          onSubmit={handleSubmit}
          noValidate
          className="space-y-5 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-block"
        >
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/50">
            Delivery details
          </h2>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-brick-400/40 bg-brick-500/10 p-3 text-sm text-brick-400"
            >
              {error}
            </p>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="receiver_name"
              label="Recipient name"
              value={form.receiver_name}
              error={errors.receiver_name}
              onChange={update('receiver_name')}
              placeholder="Full name of the recipient"
            />
            <Field
              id="receiver_phone"
              label="Mobile number"
              type="tel"
              inputMode="tel"
              dir="ltr"
              value={form.receiver_phone}
              error={errors.receiver_phone}
              onChange={update('receiver_phone')}
              placeholder="09xxxxxxxxx"
            />
            <Field
              id="province"
              label="Province"
              value={form.province}
              error={errors.province}
              onChange={update('province')}
            />
            <Field
              id="city"
              label="City"
              value={form.city}
              error={errors.city}
              onChange={update('city')}
            />
          </div>

          <Field
            id="address"
            label="Address"
            textarea
            value={form.address}
            error={errors.address}
            onChange={update('address')}
            placeholder="Street, number, unit, and any landmark that helps the courier"
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="postal_code"
              label="Postal code"
              inputMode="numeric"
              dir="ltr"
              value={form.postal_code}
              error={errors.postal_code}
              onChange={update('postal_code')}
              placeholder="10 digits"
            />
            <Field
              id="notes"
              label="Notes (optional)"
              value={form.notes}
              error={errors.notes}
              onChange={update('notes')}
              placeholder="Delivery time, gift wrap…"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-sky-500 px-4 py-3 font-bold text-white shadow-block transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting
              ? 'Placing your order…'
              : `Place order · ${formatPriceFa(total, currency)}`}
          </button>

          <p className="text-xs text-white/40">
            The final amount is verified against our catalog before the order is
            accepted.
          </p>
        </form>

        <aside className="h-fit space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-block">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/50">
            Order summary
          </h2>

          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.productId}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {item.name}
                  </span>
                  <span className="text-xs text-white/50">
                    {item.quantity} × {formatPriceFa(item.price, item.currency)}
                  </span>
                </span>
                <span className="shrink-0 font-bold">
                  {formatPriceFa(item.price * item.quantity, item.currency)}
                </span>
              </li>
            ))}
          </ul>

          {itemErrors.length > 0 && (
            <ul className="space-y-1 rounded-xl border border-brick-400/40 bg-brick-500/10 p-3 text-xs text-brick-400">
              {itemErrors.map(([field, message]) => (
                <li key={field}>{message}</li>
              ))}
            </ul>
          )}

          <div className="space-y-2 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between text-sm text-white/60">
              <span>Items</span>
              <span>{count}</span>
            </div>
            <div className="flex items-center justify-between text-lg font-black">
              <span>Total</span>
              <span className="text-sky-400">
                {formatPriceFa(total, currency)}
              </span>
            </div>
            <p className="text-xs text-white/40">
              Shipping is arranged with you once the order is confirmed.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  inputMode?: 'text' | 'tel' | 'numeric';
  textarea?: boolean;
  /** Numeric identifiers (mobile, postal code) read better forced LTR. */
  dir?: 'ltr' | 'rtl' | 'auto';
}

/**
 * One labelled input (or textarea) with its inline error.
 *
 * Kept local to this page: it exists to avoid repeating seven near-identical
 * blocks, not as a general-purpose design-system component.
 */
function Field({
  id,
  label,
  value,
  onChange,
  error,
  type = 'text',
  placeholder,
  inputMode,
  textarea = false,
  dir,
}: FieldProps) {
  const classes = `w-full rounded-xl border bg-[#0b1020] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-sky-400 ${
    error ? 'border-brick-400' : 'border-white/15'
  }`;

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-xs font-semibold uppercase tracking-widest text-white/50"
      >
        {label}
      </label>

      {textarea ? (
        <textarea
          id={id}
          name={id}
          rows={3}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          dir={dir}
          aria-invalid={error ? true : undefined}
          className={classes}
        />
      ) : (
        <input
          id={id}
          name={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          inputMode={inputMode}
          dir={dir}
          aria-invalid={error ? true : undefined}
          className={classes}
        />
      )}

      {error && <p className="mt-1 text-xs text-brick-400">{error}</p>}
    </div>
  );
}
