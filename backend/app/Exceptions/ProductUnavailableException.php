<?php

namespace App\Exceptions;

/**
 * Thrown when a cart line points at a product that has been unpublished, or was
 * deleted between validation and the locked read inside the transaction.
 */
class ProductUnavailableException extends ApiException
{
    public function __construct(
        private readonly int $productId,
        private readonly ?string $productTitle = null,
    ) {
        parent::__construct(
            $productTitle === null
                ? 'این محصول در حال حاضر قابل خریداری نیست.'
                : sprintf('«%s» در حال حاضر قابل خریداری نیست.', $productTitle),
        );
    }

    public function status(): int
    {
        return 422;
    }

    public function context(): ?array
    {
        return [
            'reason' => 'product_unavailable',
            'product_id' => $this->productId,
        ];
    }
}
