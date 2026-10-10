<?php

namespace App\Models;

use App\Support\Money;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One line of an order: a snapshot of what was bought, at what price.
 */
class OrderItem extends Model
{
    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'order_id',
        'product_id',
        'product_title',
        'unit_price',
        'quantity',
        'total_price',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * The money columns are handled by the accessors below rather than an
     * `integer` cast: a line is an invoice record, and silently truncating a
     * stored decimal (as `12.99` → `12`) would rewrite what was charged. A
     * non-integral amount reports null and the API says so.
     *
     * A line's currency is its order's currency, which is always IRT — see
     * {@see Order::currencyCode()}.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
        ];
    }

    /**
     * @return Attribute<int|null, int|string|null>
     */
    protected function unitPrice(): Attribute
    {
        return Attribute::make(
            get: fn (mixed $value): ?int => Money::toNonNegativeInteger($value),
            set: fn (mixed $value): ?int => Money::fromInput($value),
        );
    }

    /**
     * @return Attribute<int|null, int|string|null>
     */
    protected function totalPrice(): Attribute
    {
        return Attribute::make(
            get: fn (mixed $value): ?int => Money::toNonNegativeInteger($value),
            set: fn (mixed $value): ?int => Money::fromInput($value),
        );
    }

    /**
     * @return BelongsTo<Order, $this>
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
