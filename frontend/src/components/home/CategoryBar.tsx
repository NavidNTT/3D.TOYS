import { resolveTheme, withAlpha } from '@/src/lib/theme';
import type { Category } from '@/src/types/product';

interface CategoryBarProps {
  categories: Category[];
  className?: string;
}

/**
 * Horizontal strip of category badges, each tinted with its own
 * `theme_config.primary_color` so the palette on the homepage matches the
 * product pages they lead to.
 *
 * These are intentionally not links yet: there is no `/categories/[slug]` route
 * (browsing lives on the homepage grid), and a chip that looks clickable but
 * goes nowhere is worse than a plain badge. Swap the `<span>` for a `<Link>`
 * once that route exists.
 */
export default function CategoryBar({
  categories,
  className = '',
}: CategoryBarProps) {
  if (categories.length === 0) return null;

  return (
    <ul className={`flex flex-wrap items-center gap-2 ${className}`}>
      {categories.map((category) => {
        const theme = resolveTheme(category.theme_config);

        return (
          <li key={category.id}>
            <span
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold"
              style={{
                backgroundColor: withAlpha(theme.primary, 0.12),
                borderColor: withAlpha(theme.primary, 0.4),
                color: theme.primary,
              }}
            >
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: theme.primary }}
              />
              {category.name}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
