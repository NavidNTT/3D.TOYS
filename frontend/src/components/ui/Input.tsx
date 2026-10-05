import type { InputHTMLAttributes } from 'react';

/** Labelled text input (RTL-first; labels sit above the field). */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string | null;
}

export default function Input({
  label,
  hint,
  error,
  id,
  className = '',
  ...rest
}: InputProps) {
  const describedBy = error
    ? `${id}-error`
    : hint
      ? `${id}-hint`
      : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-bold text-ink/80">
          {label}
        </label>
      )}
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`rounded-lg border bg-surface px-4 py-2.5 text-ink shadow-card placeholder:text-ink/40 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 ${
          error ? 'border-red-500' : 'border-ink/15'
        } ${className}`}
        {...rest}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-bold text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink/50">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
