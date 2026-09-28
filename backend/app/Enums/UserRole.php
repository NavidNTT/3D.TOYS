<?php

namespace App\Enums;

/**
 * Account roles. The database column is a plain enum so new roles always come
 * with a migration; this backed enum is the single source of truth in PHP.
 */
enum UserRole: string
{
    case Customer = 'customer';
    case Admin = 'admin';

    /**
     * Values as stored in the database.
     *
     * @return list<string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    /**
     * Persian label for API/UI consumption.
     */
    public function label(): string
    {
        return match ($this) {
            self::Customer => 'مشتری',
            self::Admin => 'مدیر',
        };
    }
}
