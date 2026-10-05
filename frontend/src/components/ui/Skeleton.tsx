/**
 * Loading skeleton block — a pulsing warm placeholder.
 *
 * `className` carries the shape (e.g. `h-48 w-full rounded-lg`); the pulse
 * itself lives here so pages never invent their own shimmer.
 */
export default function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse bg-cream-200 ${className}`}
    />
  );
}
