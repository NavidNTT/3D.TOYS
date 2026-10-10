<?php

namespace App\Support;

use InvalidArgumentException;

/**
 * Integer-toman money arithmetic and parsing.
 *
 * The store's money contract is: currency `IRT`, unit = one toman, stored as an
 * integer, no floating point anywhere. These helpers are the *only* place
 * allowed to turn a stored value into a PHP amount, so the rule that matters —
 * "never truncate, never guess, fail closed instead" — lives in one auditable
 * spot shared by the model, the API resources, the checkout service and the
 * migration.
 *
 * Why this exists at all: a plain `(int)` cast turns the legacy value `12.99`
 * into `12`. That is not a rounding policy, it is silent data corruption, and
 * it is exactly the bug this class removes. `12.99` is simply *not* a toman
 * amount, so the answer here is `null` — never `12`.
 */
final class Money
{
    private function __construct() {}

    /**
     * The stored value as an exact, non-negative integer amount in $currency.
     *
     * Returns null — rather than rounding — whenever an exact integer cannot be
     * guaranteed:
     *
     *  - the currency is not sellable (a legacy `USD` row has no toman amount),
     *  - the value has a fractional part (`12.99` is not 12),
     *  - the value is negative, non-finite, or not a number at all.
     *
     * Callers must treat null as "this has no chargeable amount" and fail
     * closed, not coalesce it to zero.
     */
    public static function toAmount(mixed $raw, ?string $currency): ?int
    {
        if (! Currency::isSellable($currency)) {
            return null;
        }

        return self::toNonNegativeInteger($raw);
    }

    /**
     * Strict "is this exactly a non-negative integer?" — with no rounding.
     *
     * Used for currency-less amounts whose unit is already known to be toman,
     * and as the integrality assertion inside the money migration.
     */
    public static function toNonNegativeInteger(mixed $raw): ?int
    {
        if ($raw === null || is_bool($raw) || is_array($raw) || is_object($raw)) {
            return null;
        }

        if (is_int($raw)) {
            return $raw >= 0 ? $raw : null;
        }

        if (is_float($raw)) {
            if (! is_finite($raw) || $raw < 0 || floor($raw) !== $raw) {
                return null;
            }

            return (int) $raw;
        }

        if (! is_string($raw)) {
            return null;
        }

        // Digits, optionally followed by a zero fraction (`1299000.00`, as a
        // DECIMAL column reports it). Anything else — `12.99`, `1e3`, `12abc`
        // — is refused rather than coerced.
        $value = trim($raw);

        if (preg_match('/^\d+(?:\.0+)?$/', $value) !== 1) {
            return null;
        }

        $integerPart = strstr($value, '.', true);

        return (int) ($integerPart === false ? $value : $integerPart);
    }

    /**
     * Validation predicate: can this value be stored as an IRT integer?
     *
     * Shared by the `IrtAmount` validation rule and the admin panel so the
     * answer to "is this a legal toman amount?" is identical everywhere.
     */
    public static function isValidIrtAmount(mixed $value): bool
    {
        return self::toNonNegativeInteger($value) !== null;
    }

    /**
     * Normalize a value on its way into the model.
     *
     * An empty value becomes null ("no price set yet"); anything that is not an
     * exact non-negative integer is rejected loudly. Throwing — instead of
     * rounding — is deliberate: a caller that passes `12.99` has a bug, and
     * quietly storing `12` would hide it in the database forever.
     *
     * @throws InvalidArgumentException when the value cannot be an IRT integer
     */
    public static function fromInput(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        $amount = self::toNonNegativeInteger($value);

        if ($amount === null) {
            throw new InvalidArgumentException(sprintf(
                'IRT amounts must be non-negative integers; received [%s]. '
                .'Legacy decimal amounts must be preserved and reviewed, never coerced.',
                is_scalar($value) ? (string) $value : get_debug_type($value),
            ));
        }

        return $amount;
    }

    /**
     * The raw stored amount as text, verbatim.
     *
     * Legacy rows keep their original precision (`12.99`) so an operator can
     * see exactly what is waiting to be mapped, and so the UI can render the
     * legacy currency honestly instead of pretending it is toman.
     */
    public static function legacyString(mixed $raw): ?string
    {
        if ($raw === null || is_bool($raw) || is_array($raw) || is_object($raw)) {
            return null;
        }

        $value = trim((string) $raw);

        return $value === '' ? null : $value;
    }
}
