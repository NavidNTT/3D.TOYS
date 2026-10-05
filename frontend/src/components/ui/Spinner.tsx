/**
 * Inline loading spinner (border spinner, currentColor).
 *
 * `label` is announced to screen readers; visual text stays the caller's job
 * so Persian copy is never split between two components.
 */
export default function Spinner({
  label = 'در حال بارگذاری',
  className = '',
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span role="status" className={`inline-flex items-center gap-2 ${className}`}>
      <span
        aria-hidden
        className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
