import type { ReactNode } from 'react';

/**
 * Empty-state panel — icon, title, optional copy and action.
 *
 * Pages pass Persian copy in; the layout (centred card on cream) stays here.
 */
export default function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl bg-surface px-6 py-12 text-center shadow-card">
      {icon && (
        <span aria-hidden className="text-4xl">
          {icon}
        </span>
      )}
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      {description && <p className="max-w-md text-sm text-ink/60">{description}</p>}
      {action}
    </div>
  );
}
