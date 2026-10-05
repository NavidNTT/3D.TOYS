import Link from 'next/link';

/** RTL breadcrumb trail — always starts with خانه. */
export interface Crumb {
  label: string;
  href?: string;
}

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="مسیر صفحه">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-ink/60">
        <li>
          <Link href="/" className="transition hover:text-ink">
            خانه
          </Link>
        </li>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            <span aria-hidden className="text-ink/30">
              /
            </span>
            {item.href && index < items.length - 1 ? (
              <Link href={item.href} className="transition hover:text-ink">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-bold text-ink">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
