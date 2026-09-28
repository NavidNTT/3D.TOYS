<?php

namespace App\Exceptions;

/**
 * Thrown when a cart line asks for more units than the locked product row has.
 *
 * Raised inside the checkout transaction, so the whole order is rolled back and
 * no stock is held: the customer can adjust the cart and try again.
 */
class InsufficientStockException extends ApiException
{
    public function __construct(
        private readonly int $productId,
        private readonly string $productTitle,
        private readonly int $requested,
        private readonly int $available,
    ) {
        parent::__construct(sprintf(
            'موجودی «%s» کافی نیست. تعداد قابل سفارش: %d',
            $productTitle,
            $available,
        ));
    }

    public function status(): int
    {
        return 422;
    }

    public function context(): ?array
    {
        return [
            'reason' => 'insufficient_stock',
            'product_id' => $this->productId,
            'requested' => $this->requested,
            'available' => $this->available,
        ];
    }
}
