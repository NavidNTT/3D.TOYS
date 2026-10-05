import type { SelectHTMLAttributes } from 'react';

/** Labelled native select — same chrome as Input. */
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string | null;
}

export default function Select({
  label,
  error,
  id,
  className = '',
  children,
  ...rest
}: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-bold text-ink/80">
          {label}
        </label>
      )}
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        className={`rounded-lg border bg-surface px-4 py-2.5 text-ink shadow-card focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 ${
          error ? 'border-red-500' : 'border-ink/15'
        } ${className}`}
        {...rest}
      >
        {children}
      </select>
      {error && (
        <p role="alert" className="text-xs font-bold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
