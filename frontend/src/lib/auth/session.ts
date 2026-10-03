import { cookies } from 'next/headers';
import { serverApiBaseUrl } from '@/src/lib/apiBase';

/**
 * Server-side session plumbing.
 *
 * The API speaks Bearer tokens (Sanctum), which is right for non-browser
 * clients but wrong for a storefront: a token in `localStorage` is readable by
 * any script on the page. The Next.js server therefore holds the token in an
 * `httpOnly` cookie and forwards it as an `Authorization: Bearer …` header on
 * the way out, so:
 *
 *   - the browser never sees the token,
 *   - server components can read the auth state (`/orders` needs no client
 *     JavaScript to know who is signed in),
 *   - the bearer-token API keeps working unchanged for other clients.
 *
 * The cookie is intentionally *not* a Laravel session cookie: Sanctum stays
 * token-based and nothing about the API's auth contract changes.
 */

/** Name of the httpOnly cookie that carries the Sanctum token. */
export const SESSION_COOKIE = 'toys_session';

/** 30 days, matching Sanctum's default personal-access-token lifetime. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** The fields of `App\Http\Resources\UserResource` the storefront renders. */
export interface SessionUser {
  id: number;
  name: string | null;
  phone: string;
  role: string;
}

/**
 * Cookie flags.
 *
 * `secure` is only set in production: over plain `http://localhost` a Secure
 * cookie is dropped by the browser, which would silently break local logins.
 * `sameSite: 'lax'` allows normal top-level navigation to stay signed in while
 * blocking cross-site form posts.
 */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

/**
 * The stored token, or null when the visitor is signed out.
 *
 * Awaited because Next 15+ made `cookies()` asynchronous; the `await` is a
 * no-op on Next 14 and keeps this file working across the upgrade.
 */
export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();

  return store.get(SESSION_COOKIE)?.value ?? null;
}

/**
 * Resolve a token to a user through the API's existing `/auth/me` endpoint.
 *
 * Returns null for an expired or revoked token as well as for an unreachable
 * API: from the storefront's point of view a token it cannot verify is no
 * session at all, and the caller clears the cookie.
 */
export async function fetchSessionUser(
  token: string,
): Promise<SessionUser | null> {
  try {
    const response = await fetch(`${serverApiBaseUrl()}/auth/me`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      // Auth state must never be cached: a stale "signed in" answer is a
      // security bug, not a performance win.
      cache: 'no-store',
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as { data?: SessionUser };

    return payload?.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Auth state for server components.
 *
 * `null` means "not signed in" — the caller renders its signed-out state rather
 * than an error, exactly as it would for an anonymous visitor.
 */
export async function getServerSessionUser(): Promise<SessionUser | null> {
  const token = await readSessionToken();

  return token === null ? null : fetchSessionUser(token);
}

/**
 * Revoke this visitor's token at the API.
 *
 * Best effort by design: the cookie is cleared whether or not the API answers,
 * because a transient failure must not leave a browser stuck looking signed in.
 * When the call succeeds the token row is deleted, so a copy of the cookie
 * stolen before logout cannot be replayed.
 */
export async function revokeSessionToken(token: string): Promise<void> {
  try {
    await fetch(`${serverApiBaseUrl()}/auth/logout`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });
  } catch {
    // Swallowed on purpose; see the doc block above.
  }
}

/** The API's standard `{success, message, data}` envelope. */
export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * Exchange an OTP for a token through the existing passwordless API.
 *
 * The raw status and body come back untouched so the caller can pass the API's
 * own Persian message (and its 429 `Retry-After` semantics) straight to the
 * client instead of inventing a second vocabulary for the same failures.
 */
export async function verifyOtpThroughApi(
  phone: string,
  code: string,
): Promise<{ status: number; body: ApiEnvelope<unknown> | null }> {
  try {
    const response = await fetch(`${serverApiBaseUrl()}/auth/otp/verify`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone, code }),
      cache: 'no-store',
    });

    const body = (await response.json().catch(() => null)) as
      | ApiEnvelope<unknown>
      | null;

    return { status: response.status, body };
  } catch {
    // The API is unreachable: report it as a gateway failure, not as a bad code.
    return { status: 0, body: null };
  }
}

/**
 * Narrow the verify payload to `{user, token}` without trusting its shape.
 */
export function isLoginPayload(
  data: unknown,
): data is { user: SessionUser; token: string } {
  if (typeof data !== 'object' || data === null) return false;

  const candidate = data as { user?: unknown; token?: unknown };

  return (
    typeof candidate.token === 'string' &&
    candidate.token.length > 0 &&
    typeof candidate.user === 'object' &&
    candidate.user !== null
  );
}

/**
 * The bearer header a server-side API call should send for this visitor.
 *
 * Lets any server component or route handler read `my-orders` with the same
 * identity the browser sees, without the token ever reaching the client.
 */
export async function sessionAuthHeader(): Promise<Record<string, string>> {
  const token = await readSessionToken();

  return token === null ? {} : { Authorization: `Bearer ${token}` };
}