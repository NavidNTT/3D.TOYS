<?php

namespace App\Models;

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
        'thumbnail_url',
        'lighting_preset',
        'camera_settings',
        'auto_rotate',
        'rotation_speed',
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
        ];
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
