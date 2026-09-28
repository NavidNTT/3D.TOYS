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
