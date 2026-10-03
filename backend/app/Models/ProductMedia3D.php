<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * 3D media attached to a product.
 *
 * The single model for the `media3d` table: the duplicate legacy
 * `Media3d` class was merged into this one, so the Draco background
 * pipeline (`ProductMedia3DObserver` + `Optimize3DModelJob`), the
 * Filament uploads (`disk: public`, `directory: models/3d`) and the
 * `Product::media3d()` relation all resolve to exactly one Eloquent
 * class and therefore exactly one set of model events.
 *
 * @property int $id
 * @property int $product_id
 * @property string|null $original_file_url
 * @property string|null $optimized_file_url
 * @property int|null $file_size
 */
class ProductMedia3D extends Model
{
    /**
     * Share the existing 3D media table.
     *
     * @var string
     */
    protected $table = 'media3d';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'product_id',
        'original_file_url',
        'optimized_file_url',
        'thumbnail_url',
        'lighting_preset',
        'camera_settings',
        'auto_rotate',
        'rotation_speed',
        'file_size',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'camera_settings' => 'array',
            'auto_rotate' => 'boolean',
            'rotation_speed' => 'decimal:2',
            'file_size' => 'integer',
        ];
    }

    /**
     * The `ProductMedia3DObserver` (registered in `AppServiceProvider`)
     * owns the auto-dispatch for this model; no duplicate hooks here
     * so each event dispatches exactly one job.
     */
    protected static function booted(): void
    {
        //
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
