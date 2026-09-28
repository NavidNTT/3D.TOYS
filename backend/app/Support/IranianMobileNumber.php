<?php

namespace App\Support;

/**
 * Iranian mobile numbers.
 *
 * One definition, used by both the OTP endpoints and checkout: the customer's
 * login number and the number an order is delivered to must never disagree on
 * what counts as valid.
 */
final class IranianMobileNumber
{
    /**
     * 09 followed by exactly 9 digits.
     */
    public const PATTERN = '/^09[0-9]{9}$/';
}
