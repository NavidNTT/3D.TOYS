import { NextResponse } from 'next/server';
import { buildQuote, parseQuoteLines } from '@/src/services/cartQuote';

/**
 * POST /api/cart/quote
 *
 * Prices a cart from the server. The browser sends only `{productId, slug,
 * quantity}` per line — never a price — and this handler resolves each line
 * against the live catalog, so a rendered subtotal can never come from a stale
 * localStorage snapshot.
 */
export const dynamic = 'force-dynamic';

const INVALID_MESSAGE = 'اقلام سبد خرید نامعتبر است.';
const UNREACHABLE_MESSAGE =
  'ارتباط با سرور برقرار نشد. لطفاً چند لحظه بعد دوباره تلاش کنید.';

function json(success: boolean, message: string, data: unknown, status = 200) {
  return NextResponse.json({ success, message, data }, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as unknown;

  const lines = parseQuoteLines(body);

  if (lines === null) {
    return json(false, INVALID_MESSAGE, null, 422);
  }

  const quote = await buildQuote(lines);

  if (quote === null) {
    return json(false, UNREACHABLE_MESSAGE, null, 502);
  }

  return json(true, 'قیمت سبد خرید به‌روزرسانی شد.', quote);
}
