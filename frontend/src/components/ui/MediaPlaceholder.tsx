/**
 * Neutral stand-in for a product or category that has no image.
 *
 * Two rules shaped this component:
 *
 *  - **Nothing is fetched.** The mark is an inline SVG and the tint is a CSS
 *    background, so rendering a placeholder costs no request at all — a
 *    placeholder must never become the thing that boots a 3D asset or probes a
 *    missing file.
 *  - **Nothing is faked.** It does not borrow a bear logo, another product's
 *    photo or a stock toy image. A product with no picture is shown as exactly
 *    that: a labelled, deliberate empty state, which is honest and, unlike a
 *    stand-in photo, can never be mistaken for the item being sold.
 *
 * It fills its container (`h-full w-full`), so it drops into an aspect-ratio
 * media box or an absolutely-positioned card layer without changing the layout.
 */
export default function MediaPlaceholder({
  label = 'بدون تصویر',
  className = '',
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={`grid h-full w-full place-items-center bg-cream-100 ${className}`}
      data-testid="media-placeholder"
    >
      <span className="flex flex-col items-center gap-2 text-ink/35">
        <svg
          aria-hidden
          viewBox="0 0 48 48"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-12 w-12"
        >
          {/* A plain box: generic toy packaging, not any particular product. */}
          <path d="M24 6 42 15v18L24 42 6 33V15z" />
          <path d="M6 15l18 9 18-9" />
          <path d="M24 24v18" />
        </svg>
        <span className="text-[11px] font-bold">{label}</span>
      </span>
    </div>
  );
}
