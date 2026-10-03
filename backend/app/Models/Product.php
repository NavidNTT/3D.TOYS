<?php

namespace App\Models;

use Database\Factories\ProductFactory;
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
     * Money is integer Toman. One Toman is the smallest unit the shop charges,
     * so `price` and `compare_at_price` are exact integers: no float, and no
     * binary-artifact rounding, ever reaches a stored or computed total.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'price' => 'integer',
            'compare_at_price' => 'integer',
            'stock' => 'integer',
            'is_active' => 'boolean',
            'attributes' => 'array',
        ];
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

