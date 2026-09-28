<?php

namespace App\Exceptions;

use Throwable;

/**
 * Thrown when an OTP is wrong, already used, or past its expiry window.
 *
 * The message is deliberately identical for all three cases: telling an
 * attacker which one it was leaks information about whether a code existed.
 */
class InvalidOtpException extends ApiException
{
    public function __construct(string $message = 'کد تأیید نامعتبر یا منقضی شده است.', ?Throwable $previous = null)
    {
        parent::__construct($message, 0, $previous);
    }

    public function status(): int
    {
        return 422;
    }

    public function context(): ?array
    {
        return ['reason' => 'invalid_otp'];
    }
}
