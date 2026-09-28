import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from '@/src/types/product';

/**
 * A cart line.
 *
 * The product is snapshotted rather than referenced by id, so the drawer can
 * render names/prices/thumbnails without re-fetching the catalog. The tradeoff
 * is staleness: a price changed after the item was added only shows up once the
 * line is re-added (a server-side revalidation at checkout is the real fix).
 */
export interface CartItem {
  productId: number;
  slug: string;
  name: string;
  /** Unit price, in `currency`. */
  price: number;
  currency: string | null;
  thumbnailUrl: string | null;
  quantity: number;
  /** Snapshot of available stock, used to cap the quantity stepper. */
  stock: number | null;
}

interface CartState {
  items: CartItem[];
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  addItem: (product: Product, qty?: number) => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, qty: number) => void;
  clearCart: () => void;
  /** Imperative total (e.g. in an event handler, or outside React). */
  getTotalItems: () => number;
  /** Imperative total, in the cart's own currency. */
  getTotalPrice: () => number;
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
 * Components must select `items` and run these, rather than calling the store's
 * `getTotalItems()` through a hook: subscribing to a function identity never
 * changes, so Zustand would not re-render on a cart change.
 */
export function selectTotalItems(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.quantity, 0);
}

export function selectTotalPrice(items: CartItem[]): number {
  return items.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );
}

/**
 * Persisted cart.
 *
 * Only `items` is written to localStorage (`partialize`) — the drawer's open
 * state is view state, and reopening it on every reload would be a surprise.
 * Note the configurable name never receives actions.
 */
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isDrawerOpen: false,

      openDrawer: () => set({ isDrawerOpen: true }),
      closeDrawer: () => set({ isDrawerOpen: false }),

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
                name: product.name,
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

      getTotalItems: () => selectTotalItems(get().items),
      getTotalPrice: () => selectTotalPrice(get().items),
    }),
    {
      name: 'toy-store-cart',
      partialize: (state) => ({ items: state.items }),
    },
  ),
);

export default useCartStore;
