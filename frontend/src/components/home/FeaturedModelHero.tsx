'use client';

import Image from 'next/image';
import ModelPreview from '@/src/components/3d/ModelPreview';

/**
 * Hero media: a slowly rotating 3D model of the featured product.
 *
 * Exactly one canvas is used on the home page (this one). When the featured
 * product has no model — or no products exist — the poster image stands in, so
 * the hero never mounts WebGL for nothing.
 */
export default function FeaturedModelHero({
  modelUrl,
  posterUrl,
  alt,
  accentColor,
}: {
  modelUrl: string | null;
  posterUrl: string | null;
  alt: string;
  accentColor: string;
}) {
  return (
    <div
      className="relative aspect-square overflow-hidden rounded-xl bg-cream-100"
      style={{ boxShadow: `0 30px 70px -40px ${accentColor}` }}
    >
      {posterUrl && (
        <Image
          src={posterUrl}
          alt={alt}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className={`object-cover transition-opacity duration-500 ${
            modelUrl ? 'opacity-0' : 'opacity-100'
          }`}
        />
      )}

      {modelUrl ? (
        <ModelPreview modelUrl={modelUrl} className="absolute inset-0" />
      ) : (
        !posterUrl && (
          <span className="grid h-full w-full place-items-center text-5xl">
            🧸
          </span>
        )
      )}
    </div>
  );
}
