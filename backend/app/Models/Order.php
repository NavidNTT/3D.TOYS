<?php

namespace App\Models;

use App\Enums\OrderStatus;
use App\Support\Currency;
use App\Support\Money;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A placed order.
 *
 * Shipping details are copied onto the row, and each line snapshots its title
 * and price: the order is an invoice and must stay readable and unchanged even
 * after the catalog moves on.
 */
class Order extends Model
{
    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'order_number',
        'total_amount',
        'currency',
        'status',
        'receiver_name',
        'receiver_phone',
        'province',
        'city',
        'address',
        'postal_code',
        'notes',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => OrderStatus::class,
        ];
    }

    /**
     * The charged total as an exact integer amount in this order's currency.
     *
     * `total_amount` is not blindly cast to `int`: a stored decimal would be
     * truncated (`12.99` → `12`), which for an invoice is a silent, permanent
     * lie about what the customer paid. An amount that is not an exact integer
     * reports null instead, and the API surfaces that rather than a wrong
     * number.
     *
     * A row written before the currency column existed has no code; the shop
     * only ever charged toman, so the fallback is IRT.
     *
     * @return Attribute<int|null, int|string|null>
     */
    protected function totalAmount(): Attribute
    {
        return Attribute::make(
            get: fn (mixed $value, array $attributes): ?int => Money::toAmount(
                $value,
                $attributes['currency'] ?? Currency::IRT,
            ),
            set: fn (mixed $value): ?int => Money::fromInput($value),
        );
    }

    /**
     * The currency this invoice was written in; always IRT for real orders.
     */
    public function currencyCode(): string
    {
        return Currency::normalize($this->currency) ?? Currency::IRT;
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return HasMany<OrderItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }
}
