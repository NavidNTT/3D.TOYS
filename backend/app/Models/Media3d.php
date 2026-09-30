<?php

namespace App\Models;

use App\Jobs\Optimize3DModelJob;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Media3d extends Model
{
    /**
     * Explicit table name.
     *
     * @var string
     */
    protected $table = 'media3d';

    /**
     * The attributes that are mass assignable.
     *
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
     * Get the attributes that should be cast.
     *
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
     * Auto-dispatch Draco optimization when the source file is set/changed.
     *
     * This covers the Filament path: the `ProductResource` 3D section saves
     * through this legacy model (`relationship('media3d')`), not through
     * {@see ProductMedia3D}. The job looks the row up by ID, and both models
     * share the `media3d` table, so the ID is interchangeable.
     * `saveQuietly()` in the job prevents an update loop here.
     *
     * Remote URLs (http(s)://…) are viewer fixtures, never dispatched — see
     * ProductMedia3DObserver for the rationale.
     */
    protected static function booted(): void
    {
        static::created(function (Media3d $media) {
            if (! empty($media->original_file_url) && ! str_contains((string) $media->original_file_url, '://')) {
                Optimize3DModelJob::dispatch($media->id);
            }
        });

        static::updated(function (Media3d $media) {
            if ($media->wasChanged('original_file_url')
                && ! empty($media->original_file_url)
                && ! str_contains((string) $media->original_file_url, '://')) {
                Optimize3DModelJob::dispatch($media->id);
            }
        });
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
