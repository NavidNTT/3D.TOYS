import type { TextareaHTMLAttributes } from 'react';

/** Labelled multi-line input — same chrome as Input. */
export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string | null;
}

export default function Textarea({
  label,
  hint,
  error,
  id,
  className = '',
  ...rest
}: TextareaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-bold text-ink/80">
          {label}
        </label>
      )}
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        className={`min-h-24 rounded-lg border bg-surface px-4 py-2.5 text-ink shadow-card placeholder:text-ink/40 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 ${
          error ? 'border-red-500' : 'border-ink/15'
        } ${className}`}
        {...rest}
      />
      {error ? (
        <p role="alert" className="text-xs font-bold text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink/50">{hint}</p>
      ) : null}
    </div>
  );
}
