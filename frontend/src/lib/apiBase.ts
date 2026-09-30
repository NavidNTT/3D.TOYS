/**
 * Single source of truth for the Laravel API base URL.
 *
 * Two different addresses are in play, and mixing them up is the classic
 * compose-networking bug:
 *
 *   browser → NEXT_PUBLIC_API_URL    the host, via a published port (e.g. :8000)
 *   server  → LARAVEL_INTERNAL_URL   in-network, by service name (http://nginx)
 *
 * Server components run *inside* the nextjs.app container, where the host's
 * published port is unreachable, so `localhost:8000` there is a dead end.
 *
 * Every documented env value also stops short of the version prefix
 * (see .env.docker / .env.example: `.../api`, or a bare `http://nginx`), while
 * all routes live under `/api/v1` (backend/routes/api.php → Route::prefix('v1')).
 * The prefix is therefore filled in here once, instead of at every call site.
 */
const DEFAULT_API_BASE_URL = 'http://localhost:8000/api/v1';

export function normalizeApiBaseUrl(
  raw?: string | null,
  fallback: string = DEFAULT_API_BASE_URL,
): string {
  const value = (raw?.trim() || fallback).replace(/\/+$/, '');

  // Already versioned (`…/api/v1`, or a future `…/api/v2`): leave it alone.
  if (/\/api\/v\d+$/i.test(value)) return value;

  // API prefix without a version (`…/api`) → add the version.
  if (/\/api$/i.test(value)) return `${value}/v1`;

  // Bare origin (`http://nginx`) → add the whole prefix.
  return `${value}/api/v1`;
}

/** Base URL for browser-side calls: the Axios client in src/lib/api.ts. */
export function clientApiBaseUrl(): string {
  return normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL);
}

/** Base URL for fetches from server components and route handlers. */
export function serverApiBaseUrl(): string {
  return normalizeApiBaseUrl(
    process.env.LARAVEL_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL,
  );
}
