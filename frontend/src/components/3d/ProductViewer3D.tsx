'use client';

import { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Float, OrbitControls, Stage } from '@react-three/drei';
import ModelLoadBoundary from './ModelLoadBoundary';
import ToyModel, {
  DRACO_DECODER_PATH,
  type DracoDecoderPath,
  preloadToyModel,
} from './ToyModel';
import ViewerLoader from './ViewerLoader';

export interface CameraSettings {
  position?: [number, number, number];
  fov?: number;
  minDistance?: number;
  maxDistance?: number;
  autoRotateSpeed?: number;
}

interface ProductViewer3DProps {
  modelUrl: string;
  themeColor?: string;
  lightingPreset?: 'sunset' | 'dawn' | 'night' | 'warehouse' | 'forest' | 'apartment' | 'studio' | 'city' | 'park' | 'lobby';
  cameraSettings?: CameraSettings;
  /**
   * `/draco/` (default) decodes compressed models from our own origin.
   * Pass `false` to skip the decoder entirely — plain, uncompressed `.glb`
   * files then load with no decoder request at all.
   */
  dracoDecoderPath?: DracoDecoderPath;
  className?: string;
}

const DEFAULT_CAMERA: Required<CameraSettings> = {
  position: [4, 3, 6],
  fov: 40,
  minDistance: 2.5,
  maxDistance: 12,
  autoRotateSpeed: 1.2,
};

/**
 * Responsive 3D product viewer: studio Stage + soft float +
 * mobile-friendly orbit controls (pan off, zoom on, gentle autorotate).
 *
 * Works with both variants the pipeline produces: the original
 * (uncompressed `.glb`) and the Draco-compressed `_opt.glb`, decoded from the
 * local `/draco/` assets. If a model cannot be decoded, the viewer drops the
 * decoder and retries once before showing a message instead of crashing.
 */
export default function ProductViewer3D({
  modelUrl,
  themeColor = '#0b1020',
  lightingPreset = 'studio',
  cameraSettings = {},
  dracoDecoderPath = DRACO_DECODER_PATH,
  className = '',
}: ProductViewer3DProps) {
  const camera = { ...DEFAULT_CAMERA, ...cameraSettings };

  // Recovery ladder: local Draco decoder → plain glTF (no decoder) → message.
  const [activeDecoder, setActiveDecoder] = useState<DracoDecoderPath>(dracoDecoderPath);
  const [loadError, setLoadError] = useState<string | null>(null);

  // A new model (or a new decoder setting) restarts the ladder.
  useEffect(() => {
    setActiveDecoder(dracoDecoderPath);
    setLoadError(null);
  }, [modelUrl, dracoDecoderPath]);

  // Prime the cache with the path the view actually uses.
  useEffect(() => {
    if (activeDecoder !== false) {
      preloadToyModel(modelUrl, activeDecoder);
    }
  }, [modelUrl, activeDecoder]);

  return (
    <div
      className={`relative w-full aspect-square max-h-[500px] rounded-3xl overflow-hidden ${className}`}
      style={{ background: themeColor }}
    >
      <Canvas shadows camera={{ position: camera.position, fov: camera.fov }}>
        <Suspense fallback={<ViewerLoader />}>
          <Stage
            preset="soft"
            intensity={0.6}
            environment={lightingPreset}
            shadows={{ type: 'contact', opacity: 0.55, blur: 2.5 }}
          >
            <Float speed={1.4} rotationIntensity={0.4} floatIntensity={0.6}>
              <ModelLoadBoundary
                modelUrl={modelUrl}
                dracoDecoderPath={activeDecoder}
                onRecover={() => setActiveDecoder(false)}
                onFail={(error) => setLoadError(error.message)}
              >
                <ToyModel modelUrl={modelUrl} dracoDecoderPath={activeDecoder} />
              </ModelLoadBoundary>
            </Float>
          </Stage>
        </Suspense>
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          autoRotate={true}
          autoRotateSpeed={camera.autoRotateSpeed}
          minDistance={camera.minDistance}
          maxDistance={camera.maxDistance}
        />
      </Canvas>

      {loadError && (
        <div
          role="status"
          className="pointer-events-none absolute inset-x-4 bottom-4 rounded-2xl bg-black/70 px-4 py-3 text-center text-xs text-white/80 backdrop-blur"
        >
          3D preview unavailable — this model could not be loaded.
        </div>
      )}
    </div>
  );
}

