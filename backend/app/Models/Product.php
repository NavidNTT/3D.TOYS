<?php

namespace App\Models;

use App\Support\Currency;
use App\Support\Money;
use Database\Factories\ProductFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * A catalog item.
 *
 * `price` and `stock` are authoritative: checkout reads them from this row
 * (inside a lock) and never trusts an amount sent by the client.
 *
 * Money is IRT (toman) as an integer, and only when the row's currency actually
 * is IRT. A legacy row still holding `12.99` in `USD` reports a **null** price:
 * see {@see self::price()}. That null is the safety property, not an omission —
 * `12.99` is not 12 toman, and pretending otherwise is the bug this contract
 * exists to prevent.
 */
class Product extends Model
{
    /** @use HasFactory<ProductFactory> */
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'category_id',
        'title',
        'slug',
        'sku',
        'description',
        'price',
        'compare_at_price',
        'currency',
        'stock',
        'is_active',
        'attributes',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * `price` and `compare_at_price` are deliberately **absent**: they are
     * handled by the currency-aware accessors below rather than by a blind
     * `integer` cast. A cast cannot see the row's currency, so it would turn a
     * legacy `12.99 USD` into `12` — the exact truncation this contract forbids.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'stock' => 'integer',
            'is_active' => 'boolean',
            'attributes' => 'array',
        ];
    }

    /**
     * The unit price as an exact integer IRT amount, or null.
     *
     * Null means "this row has no chargeable toman amount": either the currency
     * is not IRT (a preserved legacy USD row), or the stored value is not an
     * exact integer. Callers must fail closed on null — never coalesce it to 0,
     * and never round the underlying value.
     *
     * @return Attribute<int|null, int|string|null>
     */
    protected function price(): Attribute
    {
        return Attribute::make(
            get: fn (mixed $value, array $attributes): ?int => Money::toAmount(
                $value,
                $attributes['currency'] ?? null,
            ),
            set: fn (mixed $value): ?int => Money::fromInput($value),
        );
    }

    /**
     * The strike-through price, with the same currency-aware rule as `price`.
     *
     * @return Attribute<int|null, int|string|null>
     */
    protected function compareAtPrice(): Attribute
    {
        return Attribute::make(
            get: fn (mixed $value, array $attributes): ?int => $value === null
                ? null
                : Money::toAmount($value, $attributes['currency'] ?? null),
            set: fn (mixed $value): ?int => Money::fromInput($value),
        );
    }

    /**
     * Whether this row can be sold right now, money-wise.
     *
     * Deliberately narrower than `is_active`: it answers only the currency
     * question, so `is_active && purchasable()` is the full "can be bought".
     * Mirrors the guard the checkout service applies inside its transaction.
     */
    public function purchasable(): bool
    {
        return Currency::isSellable($this->currency) && $this->price !== null;
    }

    /**
     * The preserved legacy amount for a money column, verbatim.
     *
     * After the money migration the original decimals live in the dedicated
     * `legacy_*` columns; before it they are still in place. Either way this
     * returns the exact stored text (`'12.99'`) so an operator can see what is
     * waiting to be mapped, instead of a rounded stand-in.
     */
    public function legacyAmount(string $column = 'price'): ?string
    {
        $preserved = $this->getAttribute('legacy_'.$column);

        if ($preserved !== null) {
            return Money::legacyString($preserved);
        }

        return Money::legacyString($this->getRawOriginal($column));
    }

    /**
     * The currency the preserved legacy amount was stored in, when the row has
     * been through the money migration.
     */
    public function legacyCurrency(): ?string
    {
        $preserved = Currency::normalize($this->getAttribute('legacy_currency'));

        return $preserved ?? Currency::normalize($this->currency);
    }

    /**
     * @return BelongsTo<Category, $this>
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /**
     * @return HasMany<OrderItem, $this>
     */
    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    /**
     * 3D media and viewer settings attached to this product.
     *
     * `ProductMedia3D` is the canonical model for the `media3d` table: it owns
     * the Draco auto-dispatch (`ProductMedia3DObserver` + `Optimize3DModelJob`).
     * The legacy `Media3d` model was merged into it during the Phase 1 cleanup.
     *
     * @return HasOne<ProductMedia3D, $this>
     */
    public function media3d(): HasOne
    {
        return $this->hasOne(ProductMedia3D::class);
    }
}
