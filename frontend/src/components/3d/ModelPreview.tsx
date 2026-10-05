'use client';

import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import ToyModel from './ToyModel';
import ViewerLoader from './ViewerLoader';

/**
 * Very light rotating model preview for hover/tap states (product cards).
 *
 * Deliberately not {@link ProductViewer3D}: no controls, no poster, no hint, no
 * fullscreen — just a slow spin on a small canvas, so mounting one on hover does
 * not pull the whole viewer's UI into a grid item.
 */

function Spin({ children }: { children: React.ReactNode }) {
  const ref = useRef<Group>(null);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.45;
    }
  });

  return <group ref={ref}>{children}</group>;
}

export default function ModelPreview({
  modelUrl,
  className = '',
}: {
  modelUrl: string;
  className?: string;
}) {
  return (
    <Canvas
      className={className}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 0, 5], fov: 40 }}
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 5, 4]} intensity={1.5} />
      <directionalLight position={[-4, 2, -3]} intensity={0.5} />
      <Suspense fallback={<ViewerLoader />}>
        <Spin>
          <ToyModel modelUrl={modelUrl} />
        </Spin>
      </Suspense>
    </Canvas>
  );
}
