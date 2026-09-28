<?php

namespace App\Services\Sms\Contracts;

/**
 * Transport-agnostic contract for delivering text messages.
 *
 * Application code (see App\Services\Auth\OtpService) depends only on this
 * interface, so swapping the development log driver for a real provider such
 * as Kavenegar or Ghasedak is a config change plus one class.
 */
interface SmsGatewayInterface
{
    /**
     * Deliver a one-time password to an Iranian mobile number.
     *
     * Implementations must never throw on a provider error: they return false
     * so the caller can decide how to react.
     *
     * @param  string  $phone  Normalised 11-digit mobile number (09xxxxxxxxx)
     * @param  string  $code  Plaintext OTP — the gateway is the only place it exists
     * @return bool true when the provider accepted the message
     */
    public function sendOtp(string $phone, string $code): bool;
}
