'use client';

import { Html, useProgress } from '@react-three/drei';

/**
 * In-canvas Suspense fallback: warm spinner + live loading percentage.
 *
 * Rendered through drei's `Html` so it lives inside the WebGL canvas but is
 * still real DOM (Persian text, CSS, accessibility all work normally).
 */
export default function ViewerLoader() {
  const { progress } = useProgress();

  return (
    <Html center>
      <div className="flex flex-col items-center gap-3">
        <div
          aria-hidden
          className="h-10 w-10 animate-spin rounded-full border-4 border-cream-200 border-t-brand-500"
        />
        <p className="tnum text-xs text-ink/60">{Math.round(progress)}٪</p>
        <span className="sr-only" role="status">
          در حال بارگذاری مدل سه‌بعدی
        </span>
      </div>
    </Html>
  );
}
