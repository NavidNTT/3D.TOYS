/**
 * Persian (fa-IR) price formatting.
 *
 * The storefront serves Iranian customers, so amounts are rendered with Persian
 * digits and the Persian decimal separator (e.g. `‎$۱۲٫۹۹`). The currency code
 * always comes from the API (`products.currency`); the fallback only applies
 * when a row that predates that column — or a fixture — omits it.
 */
export const DEFAULT_CURRENCY = 'USD';

export function formatPriceFa(
  value: number,
  currency?: string | null,
): string {
  const code = currency?.trim() || DEFAULT_CURRENCY;

  try {
    return new Intl.NumberFormat('fa-IR', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    // Unknown ISO code in the data: keep the Persian digits, drop the symbol.
    return `${new Intl.NumberFormat('fa-IR').format(value)} ${code}`;
  }
}

/**
 * Groups a plain amount with Persian digits (e.g. `۱۲۳٬۴۵۶`).
 *
 * Used for order totals, which carry no currency code of their own — the
 * storefront renders them with the Persian thousand separator. Decimals are
 * shown only when they exist, so round amounts read as `۲۴۱`.
 */
export function formatNumberFa(value: number): string {
  return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 }).format(
    value,
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
