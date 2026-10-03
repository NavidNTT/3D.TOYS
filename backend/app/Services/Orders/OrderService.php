<?php

namespace App\Services\Orders;

use App\Enums\OrderStatus;
use App\Exceptions\InsufficientStockException;
use App\Exceptions\ProductUnavailableException;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Place orders.
 *
 * The two rules this class exists to enforce:
 *
 *  1. The client never decides the price. Amounts are read from the product row
 *     inside the same locked read that checks stock, so a request cannot buy a
 *     500,000 Toman toy for 1,000 Toman.
 *  2. Stock never goes negative and never leaks. Validation, decrement and the
 *     order insert share one transaction, so a rejected line rolls back the
 *     whole cart — a partially-created order can never hold stock hostage.
 */
class OrderService
{
    /**
     * Place an order for a customer.
     *
     * @param  array<string, mixed>  $shipping  validated shipping snapshot
     * @param  array<int, array{product_id: int|string, quantity: int|string}>  $items
     *
     * @throws InsufficientStockException when a line exceeds the locked stock
     * @throws ProductUnavailableException when a line is unpublished or gone
     */
    public function checkout(User $user, array $shipping, array $items): Order
    {
        return DB::transaction(function () use ($user, $shipping, $items): Order {
            $products = $this->lockProducts($items);
            $lines = [];

            foreach ($items as $item) {
                $productId = (int) $item['product_id'];
                $quantity = (int) $item['quantity'];
                $product = $products->get($productId);

                // A product deleted between validation and this locked read, or
                // unpublished in the meantime.
                if (! $product instanceof Product || ! $product->is_active) {
                    throw new ProductUnavailableException($productId, $product?->title);
                }

                // Checked against the locked row, so a concurrent checkout
                // cannot sell the same unit twice.
                if ($product->stock < $quantity) {
                    throw new InsufficientStockException(
                        $product->id,
                        $product->title,
                        $quantity,
                        $product->stock,
                    );
                }

                // Integer Toman straight from the cast — no float conversion,
                // so the amount written to the invoice is exact.
                $unitPrice = (int) $product->price;

                $lines[] = [
                    'product_id' => $product->id,
                    'product_title' => $product->title,
                    'unit_price' => $unitPrice,
                    'quantity' => $quantity,
                    'total_price' => $unitPrice * $quantity,
                ];

                // Safe: this row stays locked until the transaction commits.
                $product->decrement('stock', $quantity);
            }

            $order = $user->orders()->create([
                ...$shipping,
                'order_number' => $this->generateOrderNumber(),
                'total_amount' => $this->total($lines),
                'status' => OrderStatus::Pending,
            ]);

            $order->items()->createMany($lines);

            return $order->load('items');
        });
    }

    /**
     * Read the ordered products under a row lock.
     *
     * Two details matter beyond "lock the rows":
     *
     *  - Ascending id order. When two checkouts touch the same products they
     *    acquire locks in the same sequence, so the second waits instead of
     *    deadlocking against the first.
     *  - One query for the whole cart. Prices and stock come from this single
     *    consistent read, so a price change mid-request cannot be seen twice.
     *
     * `lockForUpdate()` is a no-op on SQLite (no row locks); on MySQL — the
     * production database — it is the actual defence.
     *
     * @param  array<int, array{product_id: int|string, quantity: int|string}>  $items
     * @return Collection<int, Product>
     */
    private function lockProducts(array $items): Collection
    {
        $ids = array_values(array_unique(array_map(
            static fn (array $item): int => (int) $item['product_id'],
            $items,
        )));

        return Product::query()
            ->whereIn('id', $ids)
            ->orderBy('id')
            ->lockForUpdate()
            ->get()
            ->keyBy('id');
    }

    /**
     * Order total: the sum of the line totals, never a value taken from the
     * request.
     *
     * Integer arithmetic throughout. With Toman there is no sub-unit to round,
     * so the sum is exact by construction and there is no float noise to
     * defend against.
     *
     * @param  array<int, array<string, mixed>>  $lines
     */
    private function total(array $lines): int
    {
        return (int) array_sum(array_column($lines, 'total_price'));
    }

    /**
     * Human-quotable tracking number: TS-<yymmdd>-<6 random characters>.
     *
     * The uniqueness check is best-effort; the unique index on
     * `orders.order_number` is the real guarantee. With ~2 billion candidates
     * per day a collision is far less likely than a hardware fault, and if it
     * ever happened the insert would fail loudly rather than mix up two orders.
     */
    private function generateOrderNumber(): string
    {
        do {
            $candidate = sprintf(
                'TS-%s-%s',
                now()->format('ymd'),
                Str::upper(Str::random(6)),
            );
        } while (Order::query()->where('order_number', $candidate)->exists());

        return $candidate;
    }
}
