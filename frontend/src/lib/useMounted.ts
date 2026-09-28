'use client';

import { useEffect, useState } from 'react';

/**
 * `true` only after the first client render.
 *
 * Zustand's `persist` middleware rehydrates from localStorage synchronously on
 * the client, so a persisted value (cart count, logged-in user) differs from the
 * server-rendered HTML on the very first client render. Components gate those
 * values behind this flag to keep hydration warning-free.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}

export default useMounted;
