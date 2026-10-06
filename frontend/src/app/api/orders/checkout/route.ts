import { NextResponse } from 'next/server';
import { serverApiBaseUrl } from '@/src/lib/apiBase';
import {
  readSessionToken,
  type ApiEnvelope,
} from '@/src/lib/auth/session';
import {
  isValidIranianPhone,
  normalizePhone,
  normalizePostalCode,
} from '@/src/lib/persian';
import type { CheckoutPayload } from '@/src/types/order';

/**
 * POST /api/orders/checkout
 *
 * The browser never holds a token, so this handler reads the httpOnly session
 * cookie and forwards it as a Bearer header. Identity fields are normalised
 * (Persian digits, spacing, international prefixes) before Laravel validates
 * them; every amount is still computed server-side by `OrderService`, so
 * nothing here can influence what is charged.
 *
 * The API's status and Persian message are proxied unchanged, including its
 * 422 validation payload (`{field: [messages]}`), which the form renders.
 */
export const dynamic = 'force-dynamic';

function json(success: boolean, message: string, data: unknown, status = 200) {
  return NextResponse.json({ success, message, data }, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  const token = await readSessionToken();

  if (token === null) {
    return json(false, 'برای ثبت سفارش باید وارد حساب خود شوید.', null, 401);
  }

  const body = (await request.json().catch(() => null)) as
    | Partial<CheckoutPayload>
    | null;

  if (body === null) {
    return json(false, 'درخواست نامعتبر است.', null, 400);
  }

  const payload = {
    receiver_name: typeof body.receiver_name === 'string' ? body.receiver_name.trim() : '',
    receiver_phone: normalizePhone(String(body.receiver_phone ?? '')),
    province: typeof body.province === 'string' ? body.province.trim() : '',
    city: typeof body.city === 'string' ? body.city.trim() : '',
    address: typeof body.address === 'string' ? body.address.trim() : '',
    postal_code: normalizePostalCode(String(body.postal_code ?? '')),
    notes:
      typeof body.notes === 'string' && body.notes.trim() !== ''
        ? body.notes.trim()
        : null,
    items: Array.isArray(body.items)
      ? body.items
          .filter(
            (item) =>
              typeof item?.product_id === 'number' &&
              Number.isInteger(item.product_id) &&
              typeof item?.quantity === 'number' &&
              Number.isInteger(item.quantity),
          )
          .map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
          }))
      : [],
  };

  // Fail fast on the two fields with a strict format so the form gets an
  // instant, specific message; everything else is Laravel's to judge.
  if (!isValidIranianPhone(payload.receiver_phone)) {
    return json(
      false,
      'شماره تماس باید با ۰۹ شروع شود و ۱۱ رقم داشته باشد.',
      null,
      422,
    );
  }

  if (payload.postal_code.length !== 10) {
    return json(false, 'کد پستی باید ۱۰ رقم عددی باشد.', null, 422);
  }

  let response: Response;

  try {
    response = await fetch(`${serverApiBaseUrl()}/orders/checkout`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
  } catch {
    return json(
      false,
      'ارتباط با سرور برقرار نشد. لطفاً چند لحظه بعد دوباره تلاش کنید.',
      null,
      502,
    );
  }

  const envelope = (await response.json().catch(() => null)) as
    | ApiEnvelope<unknown>
    | null;

  return json(
    response.ok,
    envelope?.message ?? (response.ok ? 'سفارش ثبت شد.' : 'ثبت سفارش ناموفق بود.'),
    envelope?.data ?? null,
    response.status,
  );
}
