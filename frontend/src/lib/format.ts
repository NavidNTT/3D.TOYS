/**
 * Currency codes the storefront understands.
 *
 * `IRT` (toman) is the only sellable currency: the API sends integer toman and
 * nothing else may be charged. `USD` appears only on legacy rows whose original
 * amount was preserved by the money migration — it is displayed for what it is
 * and is never relabelled as toman.
 */
export const CURRENCY_IRT = 'IRT';
export const CURRENCY_USD = 'USD';

/** Shown instead of an amount when a value cannot be rendered honestly. */
export const UNPRICED_LABEL = 'قیمت نامشخص';

const PERSIAN_INTEGER = new Intl.NumberFormat('fa-IR');
const USD_AMOUNT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Uppercase, trimmed currency code, or null when there is nothing usable. */
function normalizeCurrency(currency?: string | null): string | null {
  const code = (currency ?? '').trim().toUpperCase();

  return code === '' ? null : code;
}

/**
 * A value that is exactly a non-negative integer, or null.
 *
 * This is the gate that stops `12.99` from ever rendering as `۱۲ تومان`.
 * Truncating would be arithmetic the storefront has no business doing, so a
 * fractional value is simply "no amount to show".
 */
function toIntegerAmount(
  value: number | string | null | undefined,
): number | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!/^\d+(?:\.0+)?$/.test(trimmed)) return null;

    const parsed = Number(trimmed);

    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
  }

  return null;
}

/** A finite number for legacy decimal display (US cents are real money). */
function toDecimalAmount(
  value: number | string | null | undefined,
): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (trimmed === '') return null;

    const parsed = Number(trimmed);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

/**
 * Persian (fa-IR) money formatting, driven by the amount's own currency.
 *
 *  - `IRT` → `fa-IR` grouping with Persian digits and the تومان suffix, e.g.
 *    `۱٬۲۹۹٬۰۰۰ تومان`. Integer only.
 *  - `USD` → the amount as US dollars (`$12.99`). This is the legacy, not yet
 *    mapped case: rendering it as toman would be a lie about the unit.
 *  - anything else → the amount followed by the raw code, never تومان.
 *
 * A value that is not a clean integer in a non-USD currency renders as
 * {@link UNPRICED_LABEL} rather than being rounded, so no call path can
 * silently turn `12.99` into `۱۲`.
 */
export function formatPriceFa(
  value: number | string | null | undefined,
  currency?: string | null,
): string {
  const code = normalizeCurrency(currency);

  if (code === CURRENCY_USD) {
    const amount = toDecimalAmount(value);

    return amount === null ? UNPRICED_LABEL : USD_AMOUNT.format(amount);
  }

  const amount = toIntegerAmount(value);

  if (amount === null) return UNPRICED_LABEL;

  // No code at all is read as toman: it is the store's only sellable currency,
  // and every API payload carries an explicit code anyway.
  return code === null || code === CURRENCY_IRT
    ? `${PERSIAN_INTEGER.format(amount)} تومان`
    : `${PERSIAN_INTEGER.format(amount)} ${code}`;
}

/** True when a value can be rendered as a real amount in this currency. */
export function hasAmount(
  value: number | string | null | undefined,
  currency?: string | null,
): boolean {
  const code = normalizeCurrency(currency);

  return code === CURRENCY_USD
    ? toDecimalAmount(value) !== null
    : toIntegerAmount(value) !== null;
}

/**
 * Groups a plain integer amount with Persian digits (e.g. `۱۲۳٬۴۵۶`).
 *
 * For bare counts (e.g. "۱۲ محصول") and for amounts rendered without a
 * currency unit. Money that has a currency goes through
 * {@link formatPriceFa()} instead, which is currency-aware: this function must
 * never be used to render a price, because it would drop the unit.
 *
 * Always truncated to an integer: Toman has no subunit.
 */
export function formatNumberFa(value: number): string {
  return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(
    Math.trunc(value),
  );
}

/**
 * Persian (fa-IR) calendar date, e.g. `۹ مهر ۱۴۰۵`.
 *
 * Returns an em dash for a missing or unparseable timestamp rather than
 * `Invalid Date`; the API always sends ISO-8601 or null.
 */
export function formatDateFa(value: string | Date | null | undefined): string {
  if (!value) return '—';

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(date);
}

/**
 * Converts ASCII digits inside a string to Persian digits.
 *
 * Used for order numbers (`TS-1042` → `TS-۱۰۴۲`) and any other code the
 * storefront shows: the digits are data, but Persian is the presentation
 * language, so they are rendered in the same script as the surrounding copy.
 */
export function toPersianDigits(value: string): string {
  // `charAt` rather than `[i]`: with `noUncheckedIndexedAccess` the index form
  // types as `string | undefined`, which `replace` rejects. Indexing is always
  // in range here — the regex only ever hands over an ASCII digit.
  return value.replace(/[0-9]/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'.charAt(Number(digit)));
}
