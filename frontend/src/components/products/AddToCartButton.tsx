'use client';

import { withAlpha } from '@/src/lib/theme';
import { useCartStore } from '@/src/store/useCartStore';
import type { Product } from '@/src/types/product';

interface AddToCartButtonProps {
  product: Product;
  /** Button fill, passed in from the category theme. */
  primaryColor?: string;
  /** Glow colour for the drop shadow. */
  glowColor?: string;
  /** Out-of-stock listings render a disabled button. */
  disabled?: boolean;
  className?: string;
}

/**
 * Adds one unit to the cart and slides the drawer open.
 *
 * The category colours arrive as props rather than being read from a store,
 * because the product page that renders this is a server component and
 * `theme_config` is resolved there from API data.
 */
export default function AddToCartButton({
  product,
  primaryColor = '#38bdf8',
  glowColor = '#0ea5e9',
  disabled = false,
  className = '',
}: AddToCartButtonProps) {
  const addItem = useCartStore((state) => state.addItem);
  const openDrawer = useCartStore((state) => state.openDrawer);

  const handleClick = () => {
    addItem(product, 1);
    openDrawer();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`flex-1 rounded-xl px-4 py-3 font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      style={{
        backgroundColor: primaryColor,
        boxShadow: `0 10px 30px -12px ${withAlpha(glowColor, 0.9)}`,
      }}
    >
      {disabled ? 'Notify me' : 'Add to cart'}
    </button>
  );
}
