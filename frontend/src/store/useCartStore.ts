import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from '@/src/types/product';

/**
 * A cart line.
 *
 * Only the product's identity and quantity are persisted; every rendered price
 * comes from the API (Phase 2.6). Display fields (title/thumbnail) are a
 * render-time convenience — they must never be used as a price source.
 */
export interface CartItem {
  productId: number;
  slug: string;
  title: string;
  /** Unit price in Toman, refreshed from the API before it is rendered. */
  price: number;
  /** Always IRT; kept so the contract survives a future currency. */
  currency: string | null;
  thumbnailUrl: string | null;
  quantity: number;
  /** Snapshot of available stock, used to cap the quantity stepper. */
  stock: number | null;
}

interface CartState {
  items: CartItem[];
  addItem: (product: Product, qty?: number) => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, qty: number) => void;
  clearCart: () => void;
}

/** Hard ceiling, so a stuck "+" can never produce an absurd line. */
const MAX_QUANTITY = 99;

function clampQuantity(qty: number, stock: number | null): number {
  const ceiling =
    typeof stock === 'number' && stock > 0
      ? Math.min(stock, MAX_QUANTITY)
      : MAX_QUANTITY;

  return Math.max(1, Math.min(Math.trunc(qty), ceiling));
}

/**
 * Reactive selectors.
 *
 * Components must select `items` and run these, rather than reading a derived
 * value through a hook: subscribing to a function identity never changes, so
 * Zustand would not re-render on a cart change.
 */
export function selectTotalItems(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.quantity, 0);
}

/**
 * Persisted cart.
 *
 * Only `items` is persisted to localStorage (`partialize`), so a reload always
 * lands on the same cart.
 * Note the configurable name never receives actions.
 */
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (product, qty = 1) =>
        set((state) => {
          const existing = state.items.find(
            (item) => item.productId === product.id,
          );

          if (existing) {
            return {
              items: state.items.map((item) =>
                item.productId === product.id
                  ? {
                      ...item,
                      quantity: clampQuantity(
                        item.quantity + qty,
                        item.stock,
                      ),
                    }
                  : item,
              ),
            };
          }

          return {
            items: [
              ...state.items,
              {
                productId: product.id,
                slug: product.slug,
                title: product.title,
                price: product.price,
                currency: product.currency ?? null,
                thumbnailUrl: product.media_3d?.thumbnail_url ?? null,
                quantity: clampQuantity(qty, product.stock),
                stock: product.stock ?? null,
              },
            ],
          };
        }),

      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((item) => item.productId !== productId),
        })),

      updateQuantity: (productId, qty) =>
        set((state) => {
          // Dropping to zero (or below) removes the line, which is what both
          // the stepper and a manual quantity entry expect.
          if (qty <= 0) {
            return {
              items: state.items.filter(
                (item) => item.productId !== productId,
              ),
            };
          }

          return {
            items: state.items.map((item) =>
              item.productId === productId
                ? { ...item, quantity: clampQuantity(qty, item.stock) }
                : item,
            ),
          };
        }),

      clearCart: () => set({ items: [] }),
    }),
    {
      name: 'toy-store-cart',
      partialize: (state) => ({ items: state.items }),
    },
  ),
);

export default useCartStore;
