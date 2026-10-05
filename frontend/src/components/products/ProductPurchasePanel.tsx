'use client';

import { useState } from 'react';
import Link from 'next/link';
import Button from '@/src/components/ui/Button';
import Badge from '@/src/components/ui/Badge';
import { useCartStore } from '@/src/store/useCartStore';
import type { Product } from '@/src/types/product';

/**
 * Quantity stepper + add-to-cart, with the live stock state.
 *
 * Prices shown here come from the API product payload; the cart only ever
 * stores the product id + quantity + a display snapshot. Nothing in this
 * component computes a price of its own beyond `unit × quantity`, and the
 * checkout recomputes from the server (Phase 2.6).
 */
export default function ProductPurchasePanel({ product }: { product: Product }) {
  const addItem = useCartStore((state) => state.addItem);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const inStock = product.stock > 0;
  const maxQuantity = Math.max(1, Math.min(product.stock, 99));

  const changeQuantity = (next: number) => {
    setJustAdded(false);
    setQuantity(Math.max(1, Math.min(next, maxQuantity)));
  };

  const add = () => {
    addItem(product, quantity);
    setJustAdded(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <StockBadge stock={product.stock} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex items-center rounded-md border border-ink/15 bg-surface"
          role="group"
          aria-label="تعداد"
        >
          <button
            type="button"
            onClick={() => changeQuantity(quantity - 1)}
            disabled={!inStock || quantity <= 1}
            aria-label="کاهش تعداد"
            className="grid h-10 w-10 place-items-center text-lg font-bold text-ink/70 transition hover:bg-cream-100 disabled:opacity-40"
          >
            −
          </button>
          <output
            aria-live="polite"
            className="tnum w-10 text-center text-sm font-bold text-ink"
          >
            {quantity}
          </output>
          <button
            type="button"
            onClick={() => changeQuantity(quantity + 1)}
            disabled={!inStock || quantity >= maxQuantity}
            aria-label="افزایش تعداد"
            className="grid h-10 w-10 place-items-center text-lg font-bold text-ink/70 transition hover:bg-cream-100 disabled:opacity-40"
          >
            +
          </button>
        </div>

        <Button size="lg" onClick={add} disabled={!inStock} className="flex-1">
          {inStock ? 'افزودن به سبد خرید' : 'ناموجود'}
        </Button>
      </div>

      {justAdded && (
        <p role="status" className="text-sm font-bold text-emerald-700">
          به سبد خرید اضافه شد.{' '}
          <Link href="/cart" className="underline">
            مشاهده سبد خرید
          </Link>
        </p>
      )}
    </div>
  );
}

/** Availability copy driven purely by the server's stock number. */
function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) {
    return <Badge tone="danger">ناموجود</Badge>;
  }

  if (stock <= 3) {
    return <Badge tone="warning">تنها {stock} عدد باقی مانده</Badge>;
  }

  return <Badge tone="success">موجود در انبار</Badge>;
}
