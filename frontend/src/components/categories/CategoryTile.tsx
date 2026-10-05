'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import ModelPreview from '@/src/components/3d/ModelPreview';
import { resolveTheme } from '@/src/lib/theme';
import type { Category } from '@/src/types/product';

/**
 * Showcase tile for `/categories`.
 *
 * The whole tile is a link; hovering it (after a short intent delay) fades the
 * poster out and reveals a lazily-mounted rotating model of a product in that
 * category. Only one tile's canvas is ever mounted at a time because the preview
 * is driven by that tile's own hover state.
 */
export default function CategoryTile({
  category,
  modelUrl,
  posterUrl,
}: {
  category: Category;
  modelUrl: string | null;
  posterUrl: string | null;
}) {
  const theme = resolveTheme(category.theme_config);
  const [preview, setPreview] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startPreview = () => {
    if (!modelUrl) return;
    hoverTimer.current = setTimeout(() => setPreview(true), 180);
  };

  const stopPreview = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setPreview(false);
  };

  return (
    <Link
      href={`/categories/${category.slug}`}
      onMouseEnter={startPreview}
      onMouseLeave={stopPreview}
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
          className={`object-cover transition-opacity duration-500 ${
            preview ? 'opacity-0' : 'opacity-40 group-hover:opacity-60'
          }`}
        />
      )}

      {preview && modelUrl && (
        <div className="pointer-events-none absolute inset-0">
          <ModelPreview modelUrl={modelUrl} className="absolute inset-0" />
        </div>
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
        <span className="mt-1 block text-xs text-ink/60">
          {modelUrl ? 'برای پیش‌نمایش سه‌بعدی نشانگر را نگه دارید' : 'مشاهده محصولات'}
        </span>
      </div>
    </Link>
  );
}
