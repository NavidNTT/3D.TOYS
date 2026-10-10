/**
 * Order API contracts.
 *
 * Mirrors `App\Http\Resources\OrderResource`, which is served inside the shared
 * envelope (see src/types/product.ts → ApiEnvelope). Every order line snapshots
 * its title and price at checkout time, so rendering history never depends on
 * the current catalog.
 */

/** One line of a checkout request: identity + quantity only, never a price. */
export interface CheckoutItem {
  product_id: number;
  quantity: number;
}

/**
 * The payload the checkout form posts.
 *
 * Deliberately carries no price, line total or grand total: `CheckoutRequest`
 * accepts only identities and quantities, and `OrderService` reads the amounts
 * from the locked product rows. Mirrors backend CheckoutRequest's rules.
 */
export interface CheckoutPayload {
  receiver_name: string;
  receiver_phone: string;
  province: string;
  city: string;
  address: string;
  postal_code: string;
  notes?: string | null;
  items: CheckoutItem[];
}

/** Lifecycle states, exactly as `App\Enums\OrderStatus` backs them. */
export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'completed'
  | 'cancelled';

/** One purchased line: a snapshot of title, unit price and quantity. */
export interface OrderItem {
  product_id: number | null;
  product_title: string;
  /** The line's unit. Always `'IRT'` for a real order; carried, not assumed. */
  currency?: string | null;
  unit_price: number;
  quantity: number;
  total_price: number;
}

export interface Order {
  id: number;
  order_number: string;
  status: OrderStatus;
  /** Persian label from the enum; optional so the client can fall back. */
  status_label?: string;
  total_amount: number;
  /** The invoice's unit, so the formatter never has to guess it. */
  currency?: string | null;

  /** Shipping snapshot, exactly as it was entered for this order. */
  receiver_name: string;
  receiver_phone: string;
  province?: string;
  city: string;
  address: string;
  postal_code: string;
  notes?: string | null;

  created_at: string | null;
  items: OrderItem[];
}
