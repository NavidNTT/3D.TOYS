import Link from 'next/link';

/**
 * 404 boundary for `/products/[slug]`.
 *
 * Rendered whenever `notFound()` is thrown for an unknown slug, so the dead end
 * still looks like the storefront instead of Next's default light page.
 * Note: `not-found.tsx` receives no route params, so the missing slug is not
 * echoed back — only a generic message and a way out.
 */
export default function ProductNotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[380px]"
        style={{
          background:
            'radial-gradient(60% 100% at 50% 0%, rgba(224, 57, 43, 0.22), transparent 70%)',
        }}
      />

      <p className="font-mono text-sm uppercase tracking-[0.3em] text-sunbeam-400">
        Error 404
      </p>

      <h1 className="text-3xl font-black leading-tight sm:text-4xl">
        This toy has rolled off the shelf
      </h1>

      <p className="max-w-md text-base text-white/60">
        The product you were looking for does not exist or is no longer
        available. It may have been renamed, unpublished, or the link is
        mistyped.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-xl bg-sky-500 px-5 py-3 font-bold text-white shadow-block transition hover:bg-sky-600"
        >
          Back to the storefront
        </Link>
        <Link
          href="/products/sample"
          className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-bold text-white/80 transition hover:bg-white/10"
        >
          See the 3D demo
        </Link>
      </div>
    </main>
  );
}
