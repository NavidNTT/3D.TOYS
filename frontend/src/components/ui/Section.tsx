import type { ReactNode } from 'react';

/** Vertical page section with a strict spacing rhythm. */
export default function Section({
  children,
  className = '',
  labelledBy,
}: {
  children: ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  return (
    <section aria-labelledby={labelledBy} className={`py-8 sm:py-12 ${className}`}>
      {children}
    </section>
  );
}
