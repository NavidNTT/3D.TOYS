import type { ReactNode } from 'react';

/**
 * Small status/label pill.
 *
 * `tone` picks a static warm-theme colour; pass `color` for a runtime category
 * accent (applied as inline styles — Tailwind cannot compile API colours).
 */
type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps {
  tone?: BadgeTone;
  color?: string | null;
  children: ReactNode;
  className?: string;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-cream-100 text-ink/70',
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-900',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-sky-100 text-sky-900',
};

export default function Badge({
  tone = 'neutral',
  color = null,
  children,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${TONE_CLASSES[tone]} ${className}`}
      style={
        color
          ? { backgroundColor: `${color}1f`, color, border: `1px solid ${color}66` }
          : undefined
      }
    >
      {children}
    </span>
  );
}
