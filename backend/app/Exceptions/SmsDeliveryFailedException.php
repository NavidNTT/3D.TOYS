<?php

namespace App\Exceptions;

use Throwable;

/**
 * Thrown when the SMS provider refuses or cannot deliver the code.
 *
 * 502 (Bad Gateway) is intentional: the request was valid, an upstream
 * dependency failed. The caller should retry rather than fix the payload.
 */
class SmsDeliveryFailedException extends ApiException
{
    public function __construct(string $message = 'ارسال کد تأیید با خطا مواجه شد. لطفاً دوباره تلاش کنید.', ?Throwable $previous = null)
    {
        parent::__construct($message, 0, $previous);
    }

    public function status(): int
    {
        return 502;
    }

    public function context(): ?array
    {
        return ['reason' => 'sms_delivery_failed'];
    }
}
