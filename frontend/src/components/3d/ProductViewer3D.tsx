'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Float, OrbitControls, Stage } from '@react-three/drei';
import ToyModel from './ToyModel';
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
 */
export default function ProductViewer3D({
  modelUrl,
  themeColor = '#0b1020',
  lightingPreset = 'studio',
  cameraSettings = {},
  className = '',
}: ProductViewer3DProps) {
  const camera = { ...DEFAULT_CAMERA, ...cameraSettings };

  return (
    <div
      className={`w-full aspect-square max-h-[500px] rounded-3xl overflow-hidden ${className}`}
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
              <ToyModel modelUrl={modelUrl} />
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
    </div>
  );
}
