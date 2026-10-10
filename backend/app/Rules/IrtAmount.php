<?php

namespace App\Rules;

use App\Support\Money;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * "This must be a legal IRT amount."
 *
 * The shop's money contract is an integer toman amount, so the value must be a
 * non-negative integer with no fractional part. `12.99` fails, `-1` fails,
 * `1299000` passes, and `1299000.00` passes (a DECIMAL column reports an
 * integral amount with a zero fraction).
 *
 * The check itself lives in {@see Money::isValidIrtAmount()} so the admin panel,
 * any future form request, and the model's own setter all answer the question
 * identically. There is no product-write API endpoint today — the Filament
 * panel is the only write path — so this rule is wired there.
 */
class IrtAmount implements ValidationRule
{
    public function __construct(
        private readonly string $message = 'مبلغ باید یک عدد صحیح و نامنفی به تومان باشد.',
    ) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if ($value === null || $value === '') {
            return; // Presence is a separate rule's concern.
        }

        if (! Money::isValidIrtAmount($value)) {
            $fail($this->message);
        }
    }

    /** Filament renders a rule's string form in its error summary. */
    public function __toString(): string
    {
        return 'irt_amount';
    }
}
