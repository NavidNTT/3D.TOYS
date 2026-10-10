'use client';

import { useProgress } from '@react-three/drei';

/**
 * Loading overlay for the 3D viewers: warm spinner + live loading percentage.
 *
 * Deliberately ordinary DOM rendered *outside the WebGL canvas*. It used to be
 * the same markup wrapped in drei's `<Html>`, which mounts a second React root
 * inside the canvas container — and when a model resolved quickly (a local MinIO
 * object answers in a few milliseconds) React tore that root down synchronously
 * during the very render that swapped the Suspense fallback out, so the console
 * reported:
 *
 *   "Attempted to synchronously unmount a root while React was already
 *    rendering. React cannot finish unmounting the root until the current
 *    render has completed, which may lead to a race condition."
 *
 * A DOM overlay keeps everything that mattered — the spinner, the percentage and
 * the Persian `role="status"` text — while giving React nothing extra to unmount.
 * `useProgress` reads three's global loading manager, so it works outside the
 * canvas (drei's own `<Loader />` is built the same way).
 *
 * `pointer-events-none` on purpose: the canvas underneath stays draggable while
 * the model streams in.
 */
export default function ViewerLoader({
  className = 'absolute inset-0',
}: {
  className?: string;
}) {
  const { progress } = useProgress();

  return (
    <div
      className={`pointer-events-none grid place-items-center ${className}`}
      data-testid="viewer-loader"
    >
      <div className="flex flex-col items-center gap-3 rounded-xl bg-cream-50/80 px-5 py-4 shadow-card backdrop-blur-[1px]">
        <div
          aria-hidden
          className="h-10 w-10 animate-spin rounded-full border-4 border-cream-200 border-t-brand-500"
        />
        <p className="tnum text-xs text-ink/60">{Math.round(progress)}٪</p>
        <span className="sr-only" role="status">
          در حال بارگذاری مدل سه‌بعدی
        </span>
      </div>
    </div>
  );
}
