<?php

namespace App\Models;

use App\Enums\UserRole;
use Database\Factories\UserFactory;
use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * Application user.
 *
 * Storefront authentication is passwordless: the phone number is the identity
 * and access is granted through Sanctum personal access tokens after an OTP
 * challenge. Nothing about that changes here.
 *
 * `email`/`password` exist for exactly one consumer — the Filament `/admin`
 * panel, whose login page authenticates an email + password pair. They are
 * nullable, are never read by the OTP flow, and `email` stays null for every
 * customer. The panel is still gated separately by {@see self::canAccessPanel()},
 * so holding a password is not what grants access: an administrator role is.
 */
class User extends Authenticatable implements FilamentUser
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * `email` is listed so an operator can seed or correct the panel login in
     * one call; `password` is deliberately **not** mass assignable — it is set
     * through the `hashed` cast on the attribute itself, so a stray
     * `User::create($request->all())` can never choose the hash.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'phone',
        'email',
        'role',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * A hash and a remember-me token are never part of any API payload; the
     * user resource is public-facing (see UserResource).
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * `hashed` is what makes the panel password safe by construction: assigning
     * a plaintext value (`$user->password = 'secret'`) stores a bcrypt hash, so
     * no call site has to remember to hash, and none of them can forget.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'role' => UserRole::class,
            'password' => 'hashed',
        ];
    }

    /**
     * Determine if the user can access the Filament panel.
     */
    public function canAccessPanel(Panel $panel): bool
    {
        return $this->role === 'admin'
            || $this->role === UserRole::Admin
            || $this->role?->value === 'admin';
    }

    /**
     * Convenience check used by future admin-only policies.
     */
    public function isAdmin(): bool
    {
        return $this->role === UserRole::Admin;
    }

    /**
     * Orders placed by this account.
     *
     * @return HasMany<Order, $this>
     */
    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }
}

