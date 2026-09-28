<?php

namespace App\Enums;

/**
 * Order lifecycle. The database column is a plain enum so new states always
 * come with a migration; this backed enum is the single source of truth in PHP.
 */
enum OrderStatus: string
{
    case Pending = 'pending';
    case Paid = 'paid';
    case Processing = 'processing';
    case Completed = 'completed';
    case Cancelled = 'cancelled';

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
            self::Pending => 'در انتظار پرداخت',
            self::Paid => 'پرداخت شده',
            self::Processing => 'در حال پردازش',
            self::Completed => 'تکمیل شده',
            self::Cancelled => 'لغو شده',
        };
    }
}
