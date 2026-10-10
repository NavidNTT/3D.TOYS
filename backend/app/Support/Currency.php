<?php

namespace App\Support;

/**
 * The store's currency vocabulary.
 *
 * The shop has exactly one sellable currency — Iranian toman (`IRT`), stored as
 * an integer with no subunit. `USD` exists here only because legacy rows still
 * carry it: those values are preserved verbatim and may never be charged,
 * multiplied or relabelled without an approved mapping.
 *
 * Keeping the codes in one class means "what can we charge in?" is answered in
 * one place instead of being re-guessed by the model, the resources, the
 * checkout service and the admin panel independently.
 */
final class Currency
{
    /** Iranian toman. The only currency the shop sells in; integer amounts. */
    public const IRT = 'IRT';

    /**
     * US dollar — legacy only.
     *
     * Rows carrying this code are historical data waiting for an approved
     * USD→IRT mapping. They are never converted automatically.
     */
    public const USD = 'USD';

    private function __construct() {}

    /**
     * Canonical form of a stored currency code (`'irt'` → `'IRT'`), or null
     * when there is nothing usable to normalise.
     */
    public static function normalize(?string $code): ?string
    {
        if ($code === null) {
            return null;
        }

        $normalized = strtoupper(trim($code));

        return $normalized === '' ? null : $normalized;
    }

    /**
     * Whether an amount in this currency may be charged.
     *
     * Only `IRT` qualifies. Everything else — including a null/absent code —
     * fails closed, so a new currency cannot become sellable by accident.
     */
    public static function isSellable(?string $code): bool
    {
        return self::normalize($code) === self::IRT;
    }

    /**
     * Human label for a currency code, for admin/UI copy.
     */
    public static function label(?string $code): string
    {
        return match (self::normalize($code)) {
            self::IRT => 'تومان',
            self::USD => 'دلار آمریکا',
            null => '',
            default => (string) self::normalize($code),
        };
    }
}
