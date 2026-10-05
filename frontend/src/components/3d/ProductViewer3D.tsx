'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import ModelLoadBoundary from './ModelLoadBoundary';
import ToyModel, { DRACO_PATH, type ModelBounds } from './ToyModel';
import ViewerLoader from './ViewerLoader';
import CameraRig, { type OrbitControlsRef, type ViewerPreset } from './CameraRig';

/** A spatially-anchored annotation shown on the model. */
export interface ViewerHotspot {
  id: string;
  label: string;
  position: [number, number, number];
}

export interface ProductViewer3DProps {
  modelUrl: string;
  /** Poster shown before/while the canvas loads (and if it fails). */
  posterUrl?: string | null;
  alt: string;
  /** Category accent — tints the hint and the focus ring. */
  accentColor?: string | null;
  /**
   * Annotations from the product's structured attribute data. Kept optional on
   * purpose: with no hotspot data the viewer renders none, rather than inventing
   * plausible-looking callouts. Filament can supply these later and they appear.
   */
  hotspots?: ViewerHotspot[];
  className?: string;
}

/** Persisted so the drag affordance is shown once per browser, not per visit. */
const HINT_STORAGE_KEY = 'toys:viewer-hint-dismissed';

const PRESETS: { id: ViewerPreset; label: string }[] = [
  { id: 'front', label: 'جلو' },
  { id: 'back', label: 'پشت' },
  { id: 'top', label: 'بالا' },
];

const CONTROL_BUTTON =
  'rounded-md bg-surface/90 px-3 py-1.5 text-xs font-bold text-ink/80 shadow-card backdrop-blur transition hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50';

/**
 * Lazy, AR-ready 3D product viewer.
 *
 * Performance contract: the WebGL canvas is not mounted until the container is
 * within ~200px of the viewport, and the poster image stands in until then (and
 * if the model fails to load). This keeps a grid of cards from booting a dozen
 * canvases. Touch controls and a reduced device-pixel-ratio keep mobile warm.
 */
export default function ProductViewer3D({
  modelUrl,
  posterUrl = null,
  alt,
  accentColor = null,
  hotspots = [],
  className = '',
}: ProductViewer3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<OrbitControlsRef | null>(null);

  const [inView, setInView] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  const [preset, setPreset] = useState<ViewerPreset>('front');
  const [radius, setRadius] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Draco recovery ladder: start with the local decoder; if the model cannot be
  // decoded, retry once without any decoder (plain .glb files never need one).
  const [decoder, setDecoder] = useState(true);

  // Reduced pixel ratio on small screens: the canvas is the single heaviest
  // thing on the page and phones gain little from a 2× buffer.
  const dpr = useMemo<[number, number]>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) return [1, 1.5];
    return [1, 2];
  }, []);

  // Lazy mount: only build the canvas once it is (nearly) on screen.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    try {
      setHintVisible(window.localStorage.getItem(HINT_STORAGE_KEY) !== '1');
    } catch {
      // Storage disabled (private mode): show the hint for this session only.
      setHintVisible(true);
    }
  }, []);

  useEffect(() => {
    const onChange = () =>
      setIsFullscreen(document.fullscreenElement === containerRef.current);

    document.addEventListener('fullscreenchange', onChange);

    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const dismissHint = useCallback(() => {
    setHintVisible(false);
    try {
      window.localStorage.setItem(HINT_STORAGE_KEY, '1');
    } catch {
      // Ignore: the hint simply reappears next session.
    }
  }, []);

  const onModelReady = useCallback((bounds: ModelBounds) => {
    setRadius(bounds.radius);
    setModelReady(true);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const element = containerRef.current;
    if (!element) return;

    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void element.requestFullscreen?.();
    }
  }, []);

  const dracoDecoderPath = decoder ? DRACO_PATH : false;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-xl bg-cream-100 ${
        isFullscreen ? 'h-screen w-screen rounded-none' : 'aspect-square'
      } ${className}`}
    >
      {posterUrl && (
        <Image
          src={posterUrl}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className={`object-cover transition-opacity duration-500 ${
            modelReady && !failed ? 'opacity-0' : 'opacity-100'
          }`}
        />
      )}

      {inView && !failed && (
        <Canvas
          className="absolute inset-0"
          dpr={dpr}
          gl={{ antialias: true, alpha: true }}
          camera={{ position: [0, 0, 5], fov: 40 }}
          onPointerDown={dismissHint}
        >
          <ambientLight intensity={0.9} />
          <directionalLight position={[4, 6, 5]} intensity={1.6} />
          <directionalLight position={[-5, 3, -4]} intensity={0.5} />

          <Suspense fallback={<ViewerLoader />}>
            <ModelLoadBoundary
              modelUrl={modelUrl}
              dracoDecoderPath={dracoDecoderPath}
              onRecover={() => setDecoder(false)}
              onFail={() => setFailed(true)}
            >
              <ToyModel
                modelUrl={modelUrl}
                dracoDecoderPath={dracoDecoderPath}
                onReady={onModelReady}
              />
            </ModelLoadBoundary>
          </Suspense>

          <CameraRig preset={preset} radius={radius} controlsRef={controlsRef} />

          <OrbitControls
            ref={controlsRef}
            makeDefault
            enablePan={false}
            enableZoom
            enableDamping
            dampingFactor={0.08}
            minDistance={Math.max(radius * 1.3, 0.4)}
            maxDistance={Math.max(radius * 9, 6)}
            onStart={dismissHint}
          />

          {hotspots.map((hotspot) => (
            <Hotspot key={hotspot.id} hotspot={hotspot} />
          ))}
        </Canvas>
      )}

      {failed && (
        <p
          role="status"
          className="absolute inset-x-4 bottom-4 rounded-md bg-ink/80 px-4 py-3 text-center text-xs text-cream-50 backdrop-blur"
        >
          نمایش سه‌بعدی در دسترس نیست؛ تصویر محصول نمایش داده می‌شود.
        </p>
      )}

      {hintVisible && !failed && (
        <DragHint accentColor={accentColor} onDismiss={dismissHint} />
      )}

      {inView && !failed && (
        <div className="absolute inset-x-3 bottom-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1.5" role="group" aria-label="نمای دوربین">
            {PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPreset(item.id)}
                aria-pressed={preset === item.id}
                className={CONTROL_BUTTON}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'خروج از تمام‌صفحه' : 'نمایش تمام‌صفحه'}
            aria-pressed={isFullscreen}
            className={CONTROL_BUTTON}
          >
            {isFullscreen ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه'}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * One annotation anchored to a point on the model.
 *
 * Rendered only for hotspots the caller supplies (from structured product
 * attributes); with no data the viewer shows none rather than fabricating
 * labels that do not correspond to the actual mesh.
 */
function Hotspot({ hotspot }: { hotspot: ViewerHotspot }) {
  const [open, setOpen] = useState(false);

  return (
    <Html position={hotspot.position} center>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={hotspot.label}
          className="relative grid h-6 w-6 place-items-center rounded-full bg-brand-500 text-white shadow-card ring-2 ring-white/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          <span
            aria-hidden
            className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500/40"
          />
          <span aria-hidden className="relative text-[11px] font-bold">
            i
          </span>
        </button>
        {open && (
          <span className="absolute -top-1 start-8 whitespace-nowrap rounded-md bg-ink/90 px-2 py-1 text-[11px] font-bold text-cream-50">
            {hotspot.label}
          </span>
        )}
      </div>
    </Html>
  );
}

/**
 * First-visit drag affordance: a gently animated "بکش و بچرخان" card that fades
 * after the first interaction (or a tap) and is remembered in localStorage.
 */
function DragHint({
  accentColor,
  onDismiss,
}: {
  accentColor: string | null;
  onDismiss: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onDismiss}
      aria-label="بکش و بچرخان — بستن راهنما"
      className="absolute inset-0 grid place-items-center bg-cream-50/40 backdrop-blur-[1px]"
    >
      <span className="animate-drag-hint flex flex-col items-center gap-2 rounded-xl bg-surface/95 px-6 py-4 text-center shadow-pop">
        <span aria-hidden className="text-2xl">
          👆
        </span>
        <span
          className="font-display text-lg"
          style={accentColor ? { color: accentColor } : undefined}
        >
          بکش و بچرخان
        </span>
        <span className="text-xs text-ink/60">
          برای چرخاندن اسباب‌بازی، انگشت یا موس را بکشید
        </span>
      </span>
    </button>
  );
}

