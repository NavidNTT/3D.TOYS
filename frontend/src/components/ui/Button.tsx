import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Storefront button.
 *
 * Variants map onto the warm light theme (see globals.css tokens); `primary`
 * takes an optional runtime colour when a category accent should own it.
 * Persian text needs no letter-spacing — never add `uppercase`/`tracking`
 * utilities to this component or its callers for fa content.
 */
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-brand-500 text-white shadow-card hover:bg-brand-600',
  secondary:
    'border border-ink/15 bg-surface text-ink shadow-card hover:bg-cream-100',
  ghost: 'text-ink/70 hover:bg-cream-100 hover:text-ink',
  danger: 'bg-red-600 text-white shadow-card hover:bg-red-700',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-base',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  const busy = loading || disabled;

  return (
    <button
      type={type}
      disabled={busy}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
