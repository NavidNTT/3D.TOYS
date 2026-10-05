/**
 * Persian (fa-IR) price formatting.
 *
 * Prices are integer Toman (the API's smallest unit is 1 Toman — no decimals
 * anywhere, see the Phase-1 money migration). Rendering is `fa-IR` grouping
 * with Persian digits plus the word تومان, e.g. `۱٬۲۵۰٬۰۰۰ تومان`. The
 * `currency` argument is accepted for forward-compatibility only and ignored.
 */
export function formatPriceFa(value: number): string {
  const rounded = Math.trunc(value);

  return `${new Intl.NumberFormat('fa-IR').format(rounded)} تومان`;
}

/**
 * Groups a plain integer amount with Persian digits (e.g. `۱۲۳٬۴۵۶`).
 *
 * Used for order totals, which carry no currency code of their own — the
 * storefront renders them with the Persian thousand separator. Always
 * truncated to an integer: Toman has no subunit.
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
