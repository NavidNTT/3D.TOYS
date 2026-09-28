<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * A one-time password challenge.
 *
 * Only the bcrypt hash of the code is ever persisted: the plaintext exists in
 * memory long enough to be handed to the SMS gateway and nowhere else.
 */
class OtpCode extends Model
{
    /** created_at is set by the database (useCurrent), there is no updated_at. */
    public $timestamps = false;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'phone',
        'code',
        'expires_at',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    /**
     * Codes that have not expired yet.
     *
     * @param  Builder<OtpCode>  $query
     * @return Builder<OtpCode>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('expires_at', '>', now());
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }
}
