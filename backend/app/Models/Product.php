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
        'name',
        'title',
        'slug',
        'sku',
        'description',
        'price',
        'compare_at_price',
        'currency',
        'stock',
        'is_active',
        'status',
        'attributes',
    ];

    /**
     * Boot the model. Keep name and title in sync so both storefront / checkout and admin work seamlessly.
     */
    protected static function booted(): void
    {
        static::saving(function (Product $product) {
            if (empty($product->name) && ! empty($product->title)) {
                $product->name = $product->title;
            } elseif (empty($product->title) && ! empty($product->name)) {
                $product->title = $product->name;
            }

            if (! empty($product->status)) {
                $product->is_active = ($product->status === 'active');
            } elseif (isset($product->is_active)) {
                $product->status = $product->is_active ? 'active' : 'draft';
            }
        });
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            // Stored as exact decimals in the database; the cast keeps PHP from
            // turning them into floats with binary artifacts.
            'price' => 'decimal:2',
            'compare_at_price' => 'decimal:2',
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
     * @return HasOne<Media3d, $this>
     */
    public function media3d(): HasOne
    {
        return $this->hasOne(Media3d::class);
    }
}

