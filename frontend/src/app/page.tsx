import type { Metadata } from 'next';
import Link from 'next/link';
import CategoryBar from '@/src/components/home/CategoryBar';
import ProductCard from '@/src/components/products/ProductCard';
import { getAllCategories } from '@/src/services/categoryService';
import { getAllProducts } from '@/src/services/productService';

export const metadata: Metadata = {
  title: 'Toy Store — 3D playground',
  description:
    'Spin every toy in 3D before you buy. Categories, prices and models straight from the catalog API.',
};

/**
 * Rendered per request, not prerendered.
 *
 * The catalog API is unreachable while the Docker image is built (the nextjs.app
 * container starts after Laravel), so a build-time fetch would fail the image
 * build rather than the page. Every API call still caches for 30s at the fetch
 * layer (see the services), so this is not a load spike on Laravel.
 */
export const dynamic = 'force-dynamic';

export default async function Home() {
  // One round trip instead of two: the hero, the category bar and the grid are
  // independent, so they are fetched concurrently.
  const [categories, products] = await Promise.all([
    getAllCategories(),
    getAllProducts(),
  ]);

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-12 px-6 py-16">
      <header className="max-w-3xl space-y-5">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sunbeam-400">
          Toy Store
        </p>
        <h1 className="text-4xl font-black leading-tight sm:text-5xl">
          Spin every toy in 3D
          <span className="block text-sky-400">before it reaches your door.</span>
        </h1>
        <p className="text-base text-white/70">
          Real-time WebGL previews streamed from MinIO. Every listing is modelled,
          lit and framed per category — what you rotate is what ships.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="#catalog"
            className="rounded-xl bg-sky-500 px-5 py-3 font-bold text-white shadow-block transition hover:bg-sky-600"
          >
            Browse the catalog
          </Link>
          <Link
            href="/products/sample"
            className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-bold text-white/80 transition hover:bg-white/10"
          >
            See a 3D demo
          </Link>
        </div>
      </header>

      {categories.length > 0 && (
        <section aria-labelledby="categories-heading" className="space-y-4">
          <h2
            id="categories-heading"
            className="text-sm font-semibold uppercase tracking-[0.2em] text-white/50"
          >
            Shop by category
          </h2>
          <CategoryBar categories={categories} />
        </section>
      )}

      <section
        id="catalog"
        aria-labelledby="catalog-heading"
        className="scroll-mt-8 space-y-6"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="catalog-heading" className="text-2xl font-black">
            All toys
          </h2>
          <p className="text-sm text-white/50">
            {products.length} {products.length === 1 ? 'toy' : 'toys'}
          </p>
        </div>

        {products.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-white/60">
            No toys have been published yet. Check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-white/10 pt-6 text-sm text-white/40">
        <Link className="hover:text-sky-400" href="/status">
          Stack status
        </Link>
        <span className="mx-2">·</span>
        <Link className="hover:text-sky-400" href="/login">
          Sign in
        </Link>
      </footer>
    </main>
  );
}
