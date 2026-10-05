import { formatPriceFa } from '@/src/lib/format';

/**
 * Integer-Toman price renderer.
 *
 * Every price in the storefront goes through here so Persian digits and the
 * تومان suffix stay consistent. `wasPrice` renders the compare-at strikethrough.
 */
export interface PriceProps {
  value: number;
  wasValue?: number | null;
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
  wasValue = null,
  size = 'md',
  accentColor = null,
  className = '',
}: PriceProps) {
  const showWas =
    typeof wasValue === 'number' && Number.isFinite(wasValue) && wasValue > value;

  return (
    <p className={`tnum flex flex-wrap items-baseline gap-2 ${className}`}>
      <span
        className={`font-black ${SIZE_CLASSES[size]}`}
        style={accentColor ? { color: accentColor } : undefined}
      >
        {formatPriceFa(value)}
      </span>
      {showWas && (
        <span className="text-xs text-ink/40 line-through">
          {formatPriceFa(wasValue as number)}
        </span>
      )}
    </p>
  );
}
