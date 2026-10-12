import Image from 'next/image';
import Link from 'next/link';
import { categoryPath } from '@/src/lib/catalog';
import { resolveTheme } from '@/src/lib/theme';
import type { Category } from '@/src/types/product';

/**
 * Showcase tile for `/categories`.
 *
 * The whole tile is a link into the category's product list. It used to reveal a
 * lazily-mounted rotating model of one product on hover (the shared
 * `ModelPreview` canvas); that is gone, because the storefront's 3D viewer now
 * lives only on a product's detail page. A category tile was the worst place for
 * a canvas: it is a navigation control, and a live self-sizing element inside
 * this `min-h` box could change the tile's height on hover.
 *
 * What remains is the poster when the representative product has one — with the
 * category's own tint standing in when it does not, which reads as deliberate on
 * a tinted tile — and a label that always says where the tile goes.
 */
export default function CategoryTile({
  category,
  posterUrl,
}: {
  category: Category;
  posterUrl: string | null;
}) {
  const theme = resolveTheme(category.theme_config);

  return (
    <Link
      href={categoryPath(category.slug)}
      className="group relative flex min-h-56 flex-col justify-end overflow-hidden rounded-xl border p-5 shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-pop"
      style={{
        borderColor: `${theme.primary}33`,
        backgroundColor: `${theme.primary}12`,
      }}
    >
      {posterUrl && (
        <Image
          src={posterUrl}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, 33vw"
          className="object-cover opacity-40 transition-opacity duration-500 group-hover:opacity-60"
        />
      )}

      <div className="relative">
        <span
          aria-hidden
          className="mb-2 inline-block h-3 w-3 rounded-full"
          style={{ backgroundColor: theme.primary }}
        />
        <span
          className="block font-display text-2xl"
          style={{ color: theme.primary }}
        >
          {category.name}
        </span>
        <span className="mt-1 block text-xs text-ink/60">مشاهده محصولات</span>
      </div>
    </Link>
  );
}
