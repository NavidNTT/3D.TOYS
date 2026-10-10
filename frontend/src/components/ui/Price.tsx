import { formatPriceFa, hasAmount } from '@/src/lib/format';

/**
 * Money renderer, currency-aware.
 *
 * Every price in the storefront goes through here, so the unit shown always
 * matches the unit the API sent: toman for IRT, dollars for a preserved legacy
 * USD amount, and an explicit "unavailable" label when there is no amount to
 * show at all. `wasValue` renders the compare-at strikethrough.
 *
 * `value` accepts a string because a legacy row's original amount is preserved
 * verbatim (`'12.99'`) rather than parsed into a float the storefront would
 * then have to round.
 */
export interface PriceProps {
  value: number | string | null;
  /** The amount's own currency. Defaults to toman inside the formatter. */
  currency?: string | null;
  wasValue?: number | string | null;
  size?: 'sm' | 'md' | 'lg';
  accentColor?: string | null;
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-2xl',
} as const;

export default function Price({
  value,
  currency = null,
  wasValue = null,
  size = 'md',
  accentColor = null,
  className = '',
}: PriceProps) {
  const showWas =
    typeof value === 'number' &&
    typeof wasValue === 'number' &&
    Number.isFinite(value) &&
    Number.isFinite(wasValue) &&
    wasValue > value;

  // A price can legitimately be unrenderable: a preserved legacy USD row, or a
  // row with no toman amount yet. Saying so plainly beats printing a number
  // nobody has agreed to.
  const displayable = hasAmount(value, currency);

  return (
    <p className={`tnum flex flex-wrap items-baseline gap-2 ${className}`}>
      <span
        className={
          displayable
            ? `font-black ${SIZE_CLASSES[size]}`
            : 'text-xs font-bold text-ink/45'
        }
        style={displayable && accentColor ? { color: accentColor } : undefined}
      >
        {formatPriceFa(value, currency)}
      </span>
      {showWas && (
        <span className="text-xs text-ink/40 line-through">
          {formatPriceFa(wasValue, currency)}
        </span>
      )}
    </p>
  );
}
