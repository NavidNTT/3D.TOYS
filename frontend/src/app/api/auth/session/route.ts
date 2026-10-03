import { NextResponse } from 'next/server';
import {
  fetchSessionUser,
  isLoginPayload,
  readSessionToken,
  revokeSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifyOtpThroughApi,
  type SessionUser,
} from '@/src/lib/auth/session';

/**
 * The browser's session endpoint: POST to sign in, GET to read state, DELETE to
 * sign out.
 *
 * Why this exists: the storefront must never keep a Sanctum token where page
 * JavaScript can read it. Everything below happens on the Next.js server, which
 * is the only party that ever touches the token; the browser only ever sees an
 * `httpOnly` cookie and JSON that describes the *user*.
 *
 * The API itself is untouched: it still issues and accepts bearer tokens, so
 * non-browser clients keep working exactly as before.
 */

// An auth endpoint must never be cached or statically optimised: a cached
// "signed in" reply would outlive the session it describes.
export const dynamic = 'force-dynamic';

/** Uniform envelope, so the client has one shape to read in every outcome. */
function json(
  body: { success: boolean; message: string; data?: unknown },
  status = 200,
): NextResponse {
  return NextResponse.json(body, { status });
}

/** A Persian message for "we could not reach the API", not for "bad code". */
const API_UNREACHABLE_MESSAGE =
  'ارتباط با سرور برقرار نشد. لطفاً چند لحظه بعد دوباره تلاش کنید.';

/**
 * POST /api/auth/session
 *
 * Two accepted bodies, both ending in the same httpOnly cookie:
 *
 *   { phone, code }  — the server verifies the OTP itself (page login).
 *   { token }        — an already-issued Sanctum token is stored (the
 *                      transitional path for the client-side OTP flow).
 *
 * A `token` is verified against `/auth/me` before it is stored, so a garbage
 * value can never end up in the cookie jar.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as
    | { phone?: unknown; code?: unknown; token?: unknown }
    | null;

  if (body === null) {
    return json({ success: false, message: 'درخواست نامعتبر است.' }, 400);
  }

  // ── Path 1: an existing token is being exchanged for a cookie ──────────
  if (typeof body.token === 'string' && body.token.length > 0) {
    const user = await fetchSessionUser(body.token);

    if (user === null) {
      return json(
        { success: false, message: 'نشست شما معتبر نیست. دوباره وارد شوید.' },
        401,
      );
    }

    return withSessionCookie(
      json({ success: true, message: 'ورود با موفقیت انجام شد.', data: { user } }),
      body.token,
    );
  }

  // ── Path 2: the server performs the passwordless login ────────────────
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const code = typeof body.code === 'string' ? body.code.trim() : '';

  if (phone === '' || code === '') {
    return json(
      { success: false, message: 'شماره موبایل و کد تأیید الزامی است.' },
      422,
    );
  }

  const { status, body: apiBody } = await verifyOtpThroughApi(phone, code);

  if (status === 0) {
    return json({ success: false, message: API_UNREACHABLE_MESSAGE }, 502);
  }

  if (!apiBody || !isLoginPayload(apiBody.data)) {
    // Pass the API's own Persian message through (wrong code, throttled,
    // validation): one source of truth for the wording, including the
    // rate-limit text that tells the customer how long to wait.
    return json(
      {
        success: false,
        message: apiBody?.message ?? 'ورود ناموفق بود. لطفاً دوباره تلاش کنید.',
        data: apiBody?.data ?? null,
      },
      status,
    );
  }

  return withSessionCookie(
    json({
      success: true,
      message: apiBody.message,
      data: { user: apiBody.data.user },
    }),
    apiBody.data.token,
  );
}

/**
 * GET /api/auth/session
 *
 * The current visitor's auth state, for client-side islands and for any code
 * that wants the same answer a server component gets.
 */
export async function GET(): Promise<NextResponse> {
  const token = await readSessionToken();

  if (token === null) {
    return json({ success: true, message: '', data: { authenticated: false, user: null } });
  }

  const user: SessionUser | null = await fetchSessionUser(token);

  const response = json({
    success: true,
    message: '',
    data: { authenticated: user !== null, user },
  });

  // A token the API no longer accepts (expired, revoked, rotated) means a stale
  // cookie: clear it here so the next render is honestly signed out.
  if (user === null) {
    clearSessionCookie(response);
  }

  return response;
}

/**
 * DELETE /api/auth/session
 *
 * Sign out. The token is revoked server-side first (so a copy of the cookie is
 * useless afterwards) and the cookie is cleared regardless of the outcome.
 */
export async function DELETE(): Promise<NextResponse> {
  const token = await readSessionToken();

  if (token !== null) {
    await revokeSessionToken(token);
  }

  const response = json({
    success: true,
    message: 'با موفقیت خارج شدید.',
    data: { authenticated: false, user: null },
  });

  clearSessionCookie(response);

  return response;
}

/** Attach the session cookie to an outgoing response. */
function withSessionCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());

  return response;
}

/** Expire the session cookie. */
function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE, '', {
    ...sessionCookieOptions(),
    maxAge: 0,
  });

  return response;
}