import { statSync } from 'node:fs';
import path from 'node:path';
import { notFound } from 'next/navigation';
import ProductViewer3D from '@/src/components/3d/ProductViewer3D';

export const metadata = {
  title: 'Draco check | Toy Store',
  description: 'Diagnostics page for the local Draco decoder setup.',
  robots: { index: false, follow: false },
};

/**
 * Fixtures used by `ProductViewer3D`'s two code paths. `duck_opt.glb` was
 * produced by the backend pipeline itself:
 *
 *   gltf-transform optimize duck.glb duck_opt.glb --compress draco
 */
const PLAIN_MODEL = '/models/draco-check/duck.glb';
const DRACO_MODEL = '/models/draco-check/duck_opt.glb';

function sizeOf(publicUrl: string): string {
  try {
    const bytes = statSync(path.join(process.cwd(), 'public', publicUrl.replace(/^\//, ''))).size;

    return `${(bytes / 1024).toFixed(1)} KB`;
  } catch {
    return 'missing';
  }
}

export default function DracoCheckPage() {
  // Internal diagnostics: keep it out of production builds.
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const plainSize = sizeOf(PLAIN_MODEL);
  const dracoSize = sizeOf(DRACO_MODEL);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-12">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sunbeam-400">
          Diagnostics
        </p>
        <h1 className="text-3xl font-black sm:text-4xl">Local Draco decoding check</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-white/70">
          Both viewers below load the same toy in its two pipeline variants. The decoders are
          served from <code className="font-mono text-sky-300">/draco/</code>; nothing is fetched
          from <code className="font-mono text-sky-300">gstatic.com</code>.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="font-semibold">1 · Uncompressed .glb</h2>
          <ProductViewer3D modelUrl={PLAIN_MODEL} themeColor="#0b1020" lightingPreset="studio" />
          <p className="font-mono text-xs text-white/50">
            {PLAIN_MODEL} — {plainSize} · no decoder request expected
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold">2 · Draco-optimized _opt.glb</h2>
          <ProductViewer3D modelUrl={DRACO_MODEL} themeColor="#0b1020" lightingPreset="studio" />
          <p className="font-mono text-xs text-white/50">
            {DRACO_MODEL} — {dracoSize} · decodes via /draco/
          </p>
        </section>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm leading-relaxed text-white/70">
        <h2 className="font-semibold text-white">What to look for</h2>
        <ul className="mt-3 list-inside list-disc space-y-1">
          <li>Both ducks render, drag/zoom works, and the browser console stays clean.</li>
          <li>
            Network tab: viewer 2 pulls{' '}
            <code className="font-mono text-sky-300">/draco/draco_wasm_wrapper.js</code> and{' '}
            <code className="font-mono text-sky-300">/draco/draco_decoder.wasm</code> from our own
            origin (HTTP 200, <code className="font-mono">application/wasm</code> for the .wasm).
          </li>
          <li>
            Viewer 1 must not request the decoder at all — a plain .glb never activates
            DRACOLoader.
          </li>
          <li>
            Run <code className="font-mono text-sky-300">npm run verify:draco</code> for the
            browser-free half of this check (asset hashes, wasm header, Draco payload decode).
          </li>
        </ul>
      </section>
    </main>
  );
}
