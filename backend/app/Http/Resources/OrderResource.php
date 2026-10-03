<?php

namespace App\Http\Resources;

use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Public representation of a placed order, including its line snapshots.
 *
 * Amounts are integer Toman, matching the columns they snapshot: JSON numbers
 * with no decimals, so the storefront formatter never has to round.
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
        return [
            'id' => $this->id,
            'order_number' => $this->order_number,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'total_amount' => (int) $this->total_amount,

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
                    'unit_price' => (int) $item->unit_price,
                    'quantity' => (int) $item->quantity,
                    'total_price' => (int) $item->total_price,
                ])
                ->all()),
        ];
    }
}
