import { NextResponse } from 'next/server';
import { serverApiBaseUrl } from '@/src/lib/apiBase';
import { isValidIranianPhone, normalizePhone } from '@/src/lib/persian';
import type { ApiEnvelope } from '@/src/lib/auth/session';

/**
 * POST /api/auth/otp/send
 *
 * Proxies the passwordless "send me a code" step. The number is normalised
 * here (Persian digits, `+98`/`0098` prefixes, stray spacing) before it reaches
 * Laravel, so the customer can type their number however is natural to them
 * and still match the API's `^09[0-9]{9}$` rule.
 *
 * The API's own Persian message and its 429 `Retry-After` are passed straight
 * through — one source of truth for rate-limit wording.
 */
export const dynamic = 'force-dynamic';

const UNREACHABLE_MESSAGE =
  'ارتباط با سرور برقرار نشد. لطفاً چند لحظه بعد دوباره تلاش کنید.';

function json(success: boolean, message: string, data: unknown, status = 200) {
  return NextResponse.json({ success, message, data }, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as { phone?: unknown } | null;
  const phone = normalizePhone(typeof body?.phone === 'string' ? body.phone : '');

  if (!isValidIranianPhone(phone)) {
    return json(
      false,
      'شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم داشته باشد.',
      null,
      422,
    );
  }

  let response: Response;

  try {
    response = await fetch(`${serverApiBaseUrl()}/auth/otp/send`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone }),
      cache: 'no-store',
    });
  } catch {
    return json(false, UNREACHABLE_MESSAGE, null, 502);
  }

  const payload = (await response.json().catch(() => null)) as
    | ApiEnvelope<unknown>
    | null;

  const retryAfter = response.headers.get('Retry-After');

  const forwarded = NextResponse.json(
    {
      success: response.ok,
      message: payload?.message ?? (response.ok ? 'کد تأیید ارسال شد.' : UNREACHABLE_MESSAGE),
      data: payload?.data ?? null,
    },
    { status: response.status },
  );

  if (retryAfter) forwarded.headers.set('Retry-After', retryAfter);

  return forwarded;
}
