<?php

namespace App\Http\Resources;

use App\Models\Order;
use App\Models\OrderItem;
use App\Support\Currency;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Public representation of a placed order, including its line snapshots.
 *
 * Amounts are integer Toman, matching the columns they snapshot: JSON numbers
 * with no decimals, so the storefront formatter never has to round.
 *
 * `currency` travels with the order (and with every line) because an invoice
 * must state its unit: a bare number is not an amount. Orders are only ever
 * written in `IRT` — see the checkout guard — but the field is carried rather
 * than assumed, so the formatter never has to guess.
 *
 * Amounts are read through the model accessors, which refuse to truncate: an
 * amount that is not an exact integer reports null instead of a rounded
 * stand-in. There are no such rows today, and that is the point — the shape
 * says "I don't know" rather than inventing a number.
 *
 * @mixin Order
 */
class OrderResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $currency = Currency::normalize($this->currency) ?? Currency::IRT;

        return [
            'id' => $this->id,
            'order_number' => $this->order_number,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'total_amount' => $this->total_amount,
            'currency' => $currency,

            // Shipping snapshot, exactly as it was entered for this order.
            'receiver_name' => $this->receiver_name,
            'receiver_phone' => $this->receiver_phone,
            'province' => $this->province,
            'city' => $this->city,
            'address' => $this->address,
            'postal_code' => $this->postal_code,
            'notes' => $this->notes,

            'created_at' => $this->created_at?->toIso8601String(),

            'items' => $this->whenLoaded('items', fn (): array => $this->items
                ->map(fn (OrderItem $item): array => [
                    'product_id' => $item->product_id,
                    'product_title' => $item->product_title,
                    // A line's unit is its order's unit by construction.
                    'currency' => $currency,
                    'unit_price' => $item->unit_price,
                    'quantity' => (int) $item->quantity,
                    'total_price' => $item->total_price,
                ])
                ->all()),
        ];
    }
}
