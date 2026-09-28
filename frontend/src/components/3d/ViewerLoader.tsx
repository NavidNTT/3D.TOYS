'use client';

import { Html, useProgress } from '@react-three/drei';

/** Suspense fallback: modern spinner + live loading percentage. */
export default function ViewerLoader() {
  const { progress } = useProgress();

  return (
    <Html center>
      <div className="flex flex-col items-center gap-3">
        <div
          aria-label="loading 3D model"
          className="h-10 w-10 animate-spin rounded-full border-4 border-white/15 border-t-sky-400"
        />
        <p className="font-mono text-xs text-white/70">
          {Math.round(progress)}%
        </p>
      </div>
    </Html>
  );
}
