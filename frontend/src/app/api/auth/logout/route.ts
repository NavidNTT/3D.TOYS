import { NextResponse } from 'next/server';
import {
  readSessionToken,
  revokeSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from '@/src/lib/auth/session';

/**
 * POST /api/auth/logout
 *
 * The form-friendly twin of `DELETE /api/auth/session`. The logout button in
 * the header can be a plain `<form method="post">` (no JavaScript required to
 * sign out), while the fetch-based path uses the REST verb.
 *
 * Both delete the server-side token first, then expire the cookie.
 */
export const dynamic = 'force-dynamic';

export async function POST(): Promise<NextResponse> {
  const token = await readSessionToken();

  if (token !== null) {
    await revokeSessionToken(token);
  }

  const response = NextResponse.json({
    success: true,
    message: 'با موفقیت خارج شدید.',
    data: { authenticated: false, user: null },
  });

  response.cookies.set(SESSION_COOKIE, '', {
    ...sessionCookieOptions(),
    maxAge: 0,
  });

  return response;
}