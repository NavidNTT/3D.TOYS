<?php

namespace App\Exceptions;

use App\Support\Currency;

/**
 * Thrown when a cart line cannot be charged because the product has no toman
 * amount: its currency is not `IRT` (a preserved legacy row), or its stored
 * value is not an exact integer.
 *
 * This is the checkout half of the legacy-money safety rule. The alternative —
 * casting `12.99 USD` to `12` and charging it as toman — is silent corruption,
 * so the service stops the order instead and tells the customer, in Persian,
 * that the item cannot be ordered right now. The whole checkout transaction is
 * rolled back: no order, no stock movement, nothing to clean up.
 *
 * The context carries the offending currency and the preserved amount so the
 * owner can triage which products still need a mapping.
 */
class UnsupportedCurrencyException extends ApiException
{
    public function __construct(
        private readonly int $productId,
        private readonly ?string $productTitle,
        private readonly ?string $currency,
        private readonly ?string $legacyAmount = null,
    ) {
        parent::__construct(
            $productTitle === null
                ? 'قیمت این محصول هنوز نهایی نشده است و در حال حاضر قابل خریداری نیست.'
                : sprintf('قیمت «%s» هنوز نهایی نشده است و در حال حاضر قابل خریداری نیست.', $productTitle),
        );
    }

    public function status(): int
    {
        return 422;
    }

    public function context(): ?array
    {
        return [
            'reason' => 'unsupported_currency',
            'product_id' => $this->productId,
            'currency' => Currency::normalize($this->currency),
            'legacy_amount' => $this->legacyAmount,
        ];
    }
}
