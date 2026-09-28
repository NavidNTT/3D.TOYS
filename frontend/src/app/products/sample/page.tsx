import ProductViewer3D from '../../../components/3d/ProductViewer3D';

export const metadata = {
  title: 'Sample Product | Toy Store',
  description: 'Sample 3D product viewer demo',
};

// Public Khronos sample model (2.3 MB). Swap with a MinIO URL like
// `${process.env.NEXT_PUBLIC_MINIO_URL}/toy-store-assets/<toy>.glb`
// once the asset pipeline lands.
const SAMPLE_MODEL_URL =
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Duck/glTF-Binary/Duck.glb';

const ATTRIBUTES = [
  { label: 'Material', value: 'Non-toxic ABS + plush' },
  { label: 'Dimensions', value: '18 × 12 × 10 cm' },
  { label: 'Age range', value: '3+ years' },
  { label: 'Weight', value: '320 g' },
];

export default function SampleProductPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12 lg:flex-row">
      <div className="w-full lg:w-1/2">
        <ProductViewer3D
          modelUrl={SAMPLE_MODEL_URL}
          themeColor="#0b1020"
          lightingPreset="studio"
          cameraSettings={{
            position: [4, 3, 6],
            fov: 40,
            minDistance: 2.5,
            maxDistance: 12,
            autoRotateSpeed: 1.2,
          }}
        />
        <p className="mt-3 text-center font-mono text-xs text-white/40">
          Drag to rotate · Scroll / pinch to zoom
        </p>
      </div>

      <section className="flex w-full flex-col gap-5 lg:w-1/2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sunbeam-400">
            Toy Store
          </p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            Rubber Duck — Classic Bath Toy
          </h1>
          <p className="mt-3 text-2xl font-bold text-sky-400">
            $12.99{' '}
            <span className="text-sm font-normal text-white/50">USD</span>
          </p>
        </div>

        <p className="text-base text-white/70">
          A timeless floating companion, rendered live in 3D. Inspect every
          angle in the viewer — what you spin is what ships.
        </p>

        <dl className="grid grid-cols-2 gap-3">
          {ATTRIBUTES.map((attr) => (
            <div
              key={attr.label}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <dt className="text-xs uppercase tracking-widest text-white/50">
                {attr.label}
              </dt>
              <dd className="mt-1 text-sm font-semibold">{attr.value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex gap-3">
          <button
            type="button"
            className="flex-1 rounded-xl bg-sky-500 px-4 py-3 font-bold text-white transition hover:bg-sky-600"
          >
            Add to cart
          </button>
          <button
            type="button"
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 font-bold text-white/80 transition hover:bg-white/10"
          >
            Wishlist
          </button>
        </div>
      </section>
    </main>
  );
}
