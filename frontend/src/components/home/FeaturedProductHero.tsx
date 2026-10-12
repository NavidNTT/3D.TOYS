import Image from 'next/image';
import MediaPlaceholder from '@/src/components/ui/MediaPlaceholder';

/**
 * Home-page hero media for the featured product.
 *
 * This used to mount a rotating WebGL canvas (the shared `ModelPreview`). The
 * storefront's rule is now that a 3D viewer exists only on a product's own
 * detail page, for two reasons that the hero shared with the catalogue cards:
 *
 *  - a marketing tile must not boot a WebGL context (or pull 17–21 MB of car
 *    geometry) to render a decorative image, and
 *  - a canvas is a live, self-sizing element — react-three-fiber writes its own
 *    width/height onto its wrapper and observes it with a `ResizeObserver`, so
 *    inside an `aspect-ratio` box its measurement can feed back into layout and
 *    grow the box.
 *
 * The hero therefore shows the featured product's poster, or a labelled neutral
 * placeholder when there is none, and the `دیدن محصول ویژه` button rendered
 * beside it opens the real viewer on the detail page.
 */
export default function FeaturedProductHero({
  posterUrl,
  alt,
  accentColor,
}: {
  posterUrl: string | null;
  alt: string;
  accentColor: string;
}) {
  return (
    <div
      className="relative aspect-square overflow-hidden rounded-xl bg-cream-100"
      style={{ boxShadow: `0 30px 70px -40px ${accentColor}` }}
    >
      {posterUrl ? (
        <Image
          src={posterUrl}
          alt={alt}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
        />
      ) : (
        <MediaPlaceholder />
      )}
    </div>
  );
}
