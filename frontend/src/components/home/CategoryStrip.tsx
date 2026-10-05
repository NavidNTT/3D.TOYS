import Link from 'next/link';
import { resolveTheme } from '@/src/lib/theme';
import type { Category } from '@/src/types/product';

/**
 * Horizontal strip of category chips for the home page.
 *
 * Each chip is tinted with its own `theme_config` accent (applied inline, since
 * Tailwind cannot compile runtime colours). Horizontal scroll on mobile, wrap on
 * larger screens — no carousel JavaScript for what is a plain list of links.
 */
export default function CategoryStrip({ categories }: { categories: Category[] }) {
  if (categories.length === 0) {
    return (
      <p className="text-sm text-ink/60">
        هنوز دسته‌بندی‌ای ثبت نشده است.
      </p>
    );
  }

  return (
    <ul className="flex snap-x gap-3 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible">
      {categories.map((category) => {
        const theme = resolveTheme(category.theme_config);

        return (
          <li key={category.id} className="snap-start">
            <Link
              href={`/categories/${category.slug}`}
              className="flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-bold transition hover:-translate-y-0.5"
              style={{
                color: theme.primary,
                borderColor: `${theme.primary}40`,
                backgroundColor: `${theme.primary}12`,
              }}
            >
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: theme.primary }}
              />
              {category.name}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
