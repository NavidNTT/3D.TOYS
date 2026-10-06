import { serverApiBaseUrl } from '@/src/lib/apiBase';
import { sessionAuthHeader } from '@/src/lib/auth/session';
import type { ApiEnvelope, Paginated, Product } from '@/src/types/product';
import type { Order } from '@/src/types/order';

/**
 * Server-side order + checkout access.
 *
 * Authenticated calls travel through the httpOnly session cookie
 * (`sessionAuthHeader()`), so the Sanctum token stays on the server. The
 * checkout endpoint answers 201 while every other success answers 200, and all
 * errors share the API's `{success, message, data}` envelope.
 */

export interface OrderApiError {
  message: string;
  data: unknown;
  status: number;
  retryAfterSeconds: number | null;
}

export function isOrderApiError(value: unknown): value is OrderApiError {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Record<string, unknown>;

  return (
    candidate.kind === 'order-api-error' &&
    typeof candidate.message === 'string' &&
    typeof candidate.status === 'number' &&
    (candidate.retryAfterSeconds === null ||
      typeof candidate.retryAfterSeconds === 'number')
  );
}

function apiError(
  message: string,
  data: unknown,
  status: number,
  retryAfterSeconds: number | null,
): OrderApiError {
  return { message, data, status, retryAfterSeconds, kind: 'order-api-error' } as OrderApiError;
}

function orderErrorMessage(status: number, fallback: string): string {
  if (status === 0) {
    return 'ارتباط با سرور برقرار نشد. لطفاً چند لحظه بعد دوباره تلاش کنید.';
  }

  return fallback;
}

/**
 * Narrow an order payload to a usable order, without trusting its shape.
 *
 * Server-side checkout and the my-orders list both end here; a partial order
 * is unusable, so anything that is not a well-formed object (or, for the list,
 * a non-array) becomes a service error rather than a half-render.
 */
function isOrder(value: unknown): value is Order {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.order_number === 'string' &&
    typeof candidate.total_amount === 'number' &&
    Array.isArray(candidate.items)
  );
}

/**
 * The signed-in customer's order history (newest first), via the session
 * cookie. Rejects with {@link OrderApiError}.
 */
export async function getMyOrders(): Promise<Order[]> {
  let response: Response;

  try {
    response = await fetch(`${serverApiBaseUrl()}/orders/my-orders`, {
      headers: { Accept: 'application/json', ...(await sessionAuthHeader()) },
      cache: 'no-store',
    });
  } catch {
    throw apiError(
      orderErrorMessage(0, ''),
      null,
      0,
      null,
    );
  }

  const envelope = await readEnvelope<Order[]>(response);

  if (!response.ok || !envelope || !Array.isArray(envelope.data)) {
    throw apiError(
      envelope?.message ||
        orderErrorMessage(response.status, 'دریافت سفارش‌ها ناموفق بود.'),
      envelope?.data ?? null,
      response.status,
      Number(response.headers.get('Retry-After')) || null,
    );
  }

  return envelope.data.filter(isOrder);
}

/**
 * Look up one order from the history by numeric id.
 *
 * The API exposes no single-order endpoint (see routes/api.php — only the
 * collection exists), so the detail view filters the same uncached list. An
 * unknown id is null, not an error: it renders the not-found page.
 */
export async function getMyOrderById(id: number): Promise<Order | null> {
  const orders = await getMyOrders();

  return orders.find((order) => order.id === id) ?? null;
}

/** Read a Laravel `{success, message, data}` envelope, tolerating junk. */
async function readEnvelope<T>(
  response: Response,
): Promise<{ message: string; data: T | null } | null> {
  try {
    const payload = (await response.json()) as {
      message?: unknown;
      data?: T | null;
    };

    if (typeof payload !== 'object' || payload === null) return null;

    return {
      message: typeof payload.message === 'string' ? payload.message : '',
      data: payload.data ?? null,
    };
  } catch {
    return null;
  }
}

