import type { ReactNode } from 'react';

/** White surface card — the only surface wrapper pages may use. */
export interface CardProps {
  children: ReactNode;
  className?: string;
}

export default function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`rounded-lg bg-surface shadow-card ${className}`}
    >
      {children}
    </div>
  );
}
