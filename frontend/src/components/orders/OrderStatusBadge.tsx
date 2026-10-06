import Badge from '@/src/components/ui/Badge';
import type { OrderStatus } from '@/src/types/order';

/**
 * Order status pill.
 *
 * The API sends its own Persian `status_label`; this component only chooses the
 * tone, and falls back to its own Persian wording when a resource omits the
 * label (e.g. an older payload).
 */

const TONE: Record<OrderStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  pending: 'warning',
  paid: 'info',
  processing: 'info',
  completed: 'success',
  cancelled: 'danger',
};

const FALLBACK: Record<OrderStatus, string> = {
  pending: 'در انتظار پرداخت',
  paid: 'پرداخت شده',
  processing: 'در حال پردازش',
  completed: 'تکمیل شده',
  cancelled: 'لغو شده',
};

export default function OrderStatusBadge({
  status,
  label,
}: {
  status: OrderStatus;
  label?: string;
}) {
  return <Badge tone={TONE[status] ?? 'neutral'}>{label ?? FALLBACK[status]}</Badge>;
}
